#!/usr/bin/env python3
"""Replace broken docs-studio EC2, keep Elastic IP, deploy latest main."""

from __future__ import annotations

import base64
import os
import re
import sys
import time
from pathlib import Path

import boto3
import urllib.request

REGION = "us-east-2"
OLD_INSTANCE = "i-0a59124f51fa54057"
EIP_ALLOC = "eipalloc-0b0a3f8b5ece05180"
EIP = "3.134.124.56"
SUBNET = "subnet-0d31cf900d9dc274d"
SG = "sg-0c04e9c066c66ea35"
AMI = "ami-03499a87bbb39a09a"
INSTANCE_TYPE = "t3.small"
IAM_PROFILE = "docs-studio-ec2-profile"
CF_DIST_ID = "E10RJ5P48P371U"
REPO = "https://github.com/edies76/studio.git"
BRANCH = "main"

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def build_env_local(src: dict[str, str]) -> str:
    auth = src.get("AUTH_SECRET") or base64.b64encode(os.urandom(32)).decode()
    lines = [
        f"DEEPSEEK_API_KEY={src.get('DEEPSEEK_API_KEY', '')}",
        f"DEEPSEEK_MODEL={src.get('DEEPSEEK_MODEL', 'deepseek-v4-flash')}",
        f"DEEPSEEK_BASE_URL={src.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')}",
        f"AUTH_SECRET={auth}",
        "FORCE_AUTH=0",
        "AWS_REGION=us-east-2",
        "DOCS_TABLE=docs-studio",
        "PORT=3000",
        "HOSTNAME=0.0.0.0",
        "AUTH_URL=https://docss.studio",
        "NEXTAUTH_URL=https://docss.studio",
    ]
    if src.get("AUTH_GOOGLE_ID"):
        lines.append(f"AUTH_GOOGLE_ID={src['AUTH_GOOGLE_ID']}")
    if src.get("AUTH_GOOGLE_SECRET"):
        lines.append(f"AUTH_GOOGLE_SECRET={src['AUTH_GOOGLE_SECRET']}")
    if src.get("GOOGLE_API_KEY"):
        lines.append(f"GOOGLE_API_KEY={src['GOOGLE_API_KEY']}")
    return "\n".join(lines) + "\n"


def user_data(env_b64: str) -> str:
    # Amazon Linux 2023 userdata
    return f"""#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/docs-studio-setup.log /dev/console) 2>&1

# swap helps t3.small survive npm build
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile || true
grep -q swapfile /etc/fstab || echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

dnf install -y git nginx amazon-ssm-agent
systemctl enable --now amazon-ssm-agent || true

curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
node -v
npm -v

rm -rf /opt/docs-studio
git clone --depth 1 --branch {BRANCH} {REPO} /opt/docs-studio
cd /opt/docs-studio
echo '{env_b64}' | base64 -d > .env.local
# Runtime secrets come from systemd EnvironmentFile; build does not need keys.
npm ci --prefer-offline --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=1536 npm run build

cat > /etc/systemd/system/docs-studio.service <<'EOF'
[Unit]
Description=Docs Studio Next.js
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/docs-studio
EnvironmentFile=/opt/docs-studio/.env.local
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=AWS_REGION=us-east-2
Environment=DOCS_TABLE=docs-studio
Environment=NODE_OPTIONS=--max-old-space-size=1536
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now docs-studio

cat > /etc/nginx/conf.d/docs-studio.conf <<'EOF'
server {{
  listen 80 default_server;
  server_name _;
  client_max_body_size 25m;
  location / {{
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
  }}
}}
EOF
rm -f /etc/nginx/conf.d/default.conf || true
systemctl enable --now nginx
systemctl restart nginx

# wait for local app
for i in $(seq 1 60); do
  code=$(curl -sS -o /dev/null -w '%{{http_code}}' http://127.0.0.1:3000/ || true)
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "308" ] || [ "$code" = "302" ]; then
    echo APP_UP code=$code
    break
  fi
  sleep 5
done

echo SETUP_DONE
"""


def http_ok(url: str, timeout: int = 8) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "docs-studio-redeploy"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(200).decode("utf-8", "ignore")
            return True, f"{resp.status} {body[:80]!r}"
    except Exception as e:
        return False, str(e)


def main() -> int:
    os.environ["AWS_DEFAULT_REGION"] = REGION
    os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

    src = load_env()
    if not src.get("DEEPSEEK_API_KEY"):
        print("WARN: DEEPSEEK_API_KEY missing from .env.local", file=sys.stderr)

    env_text = build_env_local(src)
    env_b64 = base64.b64encode(env_text.encode()).decode()
    ud = user_data(env_b64)

    ec2 = boto3.client("ec2", region_name=REGION)
    cf = boto3.client("cloudfront")

    print("=== Launching replacement instance ===")
    run = ec2.run_instances(
        ImageId=AMI,
        InstanceType=INSTANCE_TYPE,
        SubnetId=SUBNET,
        SecurityGroupIds=[SG],
        IamInstanceProfile={"Name": IAM_PROFILE},
        MinCount=1,
        MaxCount=1,
        UserData=ud,
        TagSpecifications=[
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": "docs-studio"},
                    {"Key": "App", "Value": "docs-studio"},
                ],
            }
        ],
    )
    new_id = run["Instances"][0]["InstanceId"]
    print("NEW_INSTANCE", new_id)

    print("Waiting for running...")
    waiter = ec2.get_waiter("instance_running")
    waiter.wait(InstanceIds=[new_id])
    print("Instance running")

    # Give network interface a moment
    time.sleep(8)

    instance = ec2.describe_instances(InstanceIds=[new_id])["Reservations"][0]["Instances"][0]
    candidate_ip = instance.get("PublicIpAddress")
    if not candidate_ip:
        print("Candidate has no public IP")
        return 2

    print("=== Polling candidate http://%s/ before moving traffic (build can take 8-15 min) ===" % candidate_ip)
    deadline = time.time() + 20 * 60
    n = 0
    while time.time() < deadline:
        n += 1
        ok, msg = http_ok(f"http://{candidate_ip}/api/health", timeout=10)
        print(f"try {n}: candidate {ok} {msg}")
        if ok:
            break
        time.sleep(20)
    else:
        print("Candidate never came up; traffic was not changed")
        return 2

    print(f"Associating Elastic IP {EIP} -> {new_id}")
    ec2.associate_address(AllocationId=EIP_ALLOC, InstanceId=new_id, AllowReassociation=True)

    print("Invalidating CloudFront", CF_DIST_ID)
    try:
        inv = cf.create_invalidation(
            DistributionId=CF_DIST_ID,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/*"]},
                "CallerReference": f"docs-studio-{int(time.time())}",
            },
        )
        print("invalidation", inv["Invalidation"]["Id"], inv["Invalidation"]["Status"])
    except Exception as e:
        print("CF invalidation warn:", e)

    print("=== Polling https://docss.studio/ ===")
    for i in range(1, 25):
        ok, msg = http_ok("https://docss.studio/", timeout=15)
        print(f"cf try {i}: {ok} {msg}")
        if ok:
            print("SITE_UP")
            return 0
        time.sleep(15)

    print("CloudFront still failing after origin up — check origin protocol / SG")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
