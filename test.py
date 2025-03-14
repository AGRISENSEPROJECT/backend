#!/usr/bin/env python3

from secret import key  # Import the RC4 key

def rc4_keystream(length):
    S = [x for x in range(256)]
    j = 0

    # Key-Scheduling Algorithm (KSA)
    for i in range(256):
        j = (j + S[i] + ord(key[i % len(key)])) % 256
        S[i], S[j] = S[j], S[i]

    # PRGA Phase (Generating Keystream)
    i = j = 0
    keystream = []
    while len(keystream) < length:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        keystream.append(S[(S[i] + S[j]) % 256])

    return keystream

# Read the encrypted hex string from the file
with open("/home/nelson/Documents/message.txt", "r") as f:
    encrypted_hex = f.read().strip()

# Convert hex to bytes
ciphertext = bytes.fromhex(encrypted_hex)

# Generate the correct RC4 keystream
keystream = rc4_keystream(len(ciphertext))

# XOR to decrypt
plaintext = ''.join(chr(ciphertext[i] ^ keystream[i]) for i in range(len(ciphertext)))

print("Decrypted Message:", plaintext)
