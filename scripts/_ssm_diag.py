import boto3
import time
import os

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-2")
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

ec2 = boto3.client("ec2", region_name="us-east-2")
ssm = boto3.client("ssm", region_name="us-east-2")
iid = "i-0a59124f51fa54057"

r = ec2.describe_instances(InstanceIds=[iid])
i = r["Reservations"][0]["Instances"][0]
print("STATE", i["State"]["Name"], "IP", i.get("PublicIpAddress"), "DNS", i.get("PublicDnsName"))

info = ssm.describe_instance_information(
    Filters=[{"Key": "InstanceIds", "Values": [iid]}]
)
print("SSM", info.get("InstanceInformationList"))

cmds = [
    "set -x",
    "systemctl is-active docs-studio || true",
    "systemctl is-active nginx || true",
    "ss -lntp | head -30 || netstat -lntp | head -30 || true",
    'curl -sS -m 3 -o /dev/null -w "local3000=%{http_code}\\n" http://127.0.0.1:3000/ || true',
    'curl -sS -m 3 -o /dev/null -w "local80=%{http_code}\\n" http://127.0.0.1/ || true',
    "tail -n 50 /var/log/docs-studio-setup.log 2>/dev/null || true",
    "journalctl -u docs-studio -n 40 --no-pager 2>/dev/null || true",
    "ls -la /opt/docs-studio 2>/dev/null | head -25 || echo NO_APP_DIR",
    "cd /opt/docs-studio && git rev-parse --short HEAD 2>/dev/null || true",
    "cd /opt/docs-studio && head -5 package.json 2>/dev/null || true",
    "which node; node -v 2>/dev/null || true",
    "which nginx; nginx -v 2>&1 || true",
]

resp = ssm.send_command(
    InstanceIds=[iid],
    DocumentName="AWS-RunShellScript",
    Parameters={"commands": cmds},
    TimeoutSeconds=90,
)
cid = resp["Command"]["CommandId"]
print("CMD", cid)

for _ in range(30):
    time.sleep(3)
    out = ssm.get_command_invocation(CommandId=cid, InstanceId=iid)
    st = out["Status"]
    print("status", st)
    if st in ("Success", "Failed", "Cancelled", "TimedOut"):
        print("=== STDOUT ===")
        print(out.get("StandardOutputContent", "")[:6000])
        print("=== STDERR ===")
        print(out.get("StandardErrorContent", "")[:2000])
        break
else:
    print("TIMEOUT waiting for SSM")
