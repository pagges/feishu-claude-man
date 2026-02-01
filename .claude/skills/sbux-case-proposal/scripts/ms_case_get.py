#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MeterSphere 用例详情查询
根据 case_id 获取用例完整信息
"""

import argparse
import base64
import json
import sys
import time
from typing import Dict, Optional

try:
    import requests
except ImportError:
    print("Error: requests module not found. Please install: pip3 install requests", file=sys.stderr)
    sys.exit(1)

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import padding
except ImportError:
    print("Error: cryptography module not found. Please install: pip3 install cryptography", file=sys.stderr)
    sys.exit(1)


def generate_signature(access_key: str, secret_key: str) -> str:
    """生成 API 签名（AES-128-CBC）"""
    timestamp = str(int(time.time() * 1000))
    plain_text = f"{access_key}|{timestamp}"

    key = secret_key.encode('utf-8')[:16].ljust(16, b'\x00')
    iv = access_key.encode('utf-8')[:16].ljust(16, b'\x00')

    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plain_text.encode('utf-8')) + padder.finalize()

    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()

    return base64.b64encode(encrypted).decode('utf-8')


def case_get(base_url: str, access_key: str, secret_key: str, case_id: str) -> Optional[Dict]:
    """获取用例详情"""
    url = f"{base_url}/api/api/testcase/get/{case_id}"

    headers = {
        "accessKey": access_key,
        "signature": generate_signature(access_key, secret_key),
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            return data.get("data")
        else:
            print(f"Error: {data.get('message')}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error getting case: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="Get MeterSphere case details")
    parser.add_argument("--base-url", required=True, help="MeterSphere base URL")
    parser.add_argument("--access-key", required=True, help="API access key")
    parser.add_argument("--secret-key", required=True, help="API secret key")
    parser.add_argument("--case-id", required=True, help="Case ID")

    args = parser.parse_args()

    case = case_get(args.base_url, args.access_key, args.secret_key, args.case_id)
    if case:
        print(json.dumps(case, ensure_ascii=False, indent=2))
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
