# Create Docs Studio DynamoDB table (on-demand = cheap / free-tier friendly)
# Usage:  .\scripts\aws-create-dynamodb.ps1 [-TableName docs-studio] [-Region us-east-1]

param(
  [string]$TableName = "docs-studio",
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" })
)

Write-Host "Creating table $TableName in $Region ..."

aws dynamodb create-table `
  --table-name $TableName `
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S `
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  --region $Region

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK. Set env: DOCS_TABLE=$TableName  AWS_REGION=$Region"
} else {
  Write-Host "Failed (table may already exist). Check: aws dynamodb describe-table --table-name $TableName --region $Region"
}
