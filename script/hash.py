#!/usr/bin/env python3
"""
Hash - v26.06.19-4

Description:
  A standalone Python script to test various hashing algorithms (MD5, SHA-1, SHA-256, SHA-512) 
  on a target string. This version condenses the console output headers for a cleaner look.

Usage:
  python3 hash.py
  python3 hash.py -s "your custom string"
  python3 hash.py -s "test string" -t 8
"""

import argparse
import hashlib
import sys

def main():
    # Disable default help generation so we can override it with your docstring
    parser = argparse.ArgumentParser(add_help=False)
    
    parser.add_argument(
        '-h', '--help', 
        action='store_true', 
        help='Show this help message and exit'
    )
    parser.add_argument(
        '-s', '--string', 
        type=str, 
        help='The string to hash. Uses a default if not provided.'
    )
    parser.add_argument(
        '-t', '--trim', 
        type=int, 
        help='Number of characters to trim the hash to. Omit for the full hash.'
    )

    args = parser.parse_args()

    # Intercept help flag to display the exact docstring format
    if args.help:
        print(__doc__.strip())
        sys.exit(0)

    default_string = "zola/Agape/Agape No.1"
    target_string = args.string or default_string
    trim_length = args.trim

    print(f"Value   : {target_string}")
    if trim_length:
        print(f"Length  : {trim_length} characters\n")
    else:
        print("Length  : Full length hashes\n")

    encoded_data = target_string.encode('utf-8')

    # Dictionary mapping the display name to the hashlib function
    algorithms = {
        'MD5': hashlib.md5,
        'SHA-1': hashlib.sha1,
        'SHA-256': hashlib.sha256,
        'SHA-512': hashlib.sha512
    }

    for name, algo_func in algorithms.items():
        # Generate the hash
        hash_obj = algo_func(encoded_data)
        hex_digest = hash_obj.hexdigest()
        
        # Apply trimming if the argument was provided
        if trim_length:
            hex_digest = hex_digest[:trim_length]
            
        # Cleanly aligned raw output
        print(f"{name.ljust(8)}: {hex_digest}")

if __name__ == '__main__':
    main()