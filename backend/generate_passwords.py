#!/usr/bin/env python3
import bcrypt
import secrets
import string

def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Generate passwords
admin_pass = generate_password(14)
agent1_pass = generate_password(12)
agent2_pass = generate_password(12)

# Generate hashes
admin_hash = hash_password(admin_pass)
agent1_hash = hash_password(agent1_pass)
agent2_hash = hash_password(agent2_pass)

print("=" * 70)
print("STRONG PASSWORDS GENERATED")
print("=" * 70)
print()
print("PASSWORDS (SAVE THESE!):")
print(f"  admin: {admin_pass}")
print(f"  8013:  {agent1_pass}")
print(f"  8014:  {agent2_pass}")
print()
print("=" * 70)
print("SQL UPDATE COMMANDS")
print("=" * 70)
print()
print("-- Run these in PostgreSQL:")
print("\\c dialer_db")
print()
print(f"UPDATE agents SET password_hash = '{admin_hash}' WHERE username = 'admin';")
print(f"UPDATE agents SET password_hash = '{agent1_hash}' WHERE username = '8013';")
print(f"UPDATE agents SET password_hash = '{agent2_hash}' WHERE username = '8014';")
print()
print("-- Verify:")
print("SELECT username, LEFT(password_hash, 30) as hash FROM agents WHERE username IN ('admin', '8013', '8014');")
