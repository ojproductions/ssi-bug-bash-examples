# Added for the bug bash: pins every deployment to one region so all task
# definitions land in the same place as the other ECS examples.

variable "aws_region" {
  description = "AWS region for the bug bash. Everything runs in sa-east-1."
  type        = string
  default     = "sa-east-1"
}

provider "aws" {
  region = var.aws_region
}
