def rc4_keystream(key, length):
    S = [x for x in range(256)]
    j = 0
    for i in range(256):
        j = (j + S[i] + ord(key[i % len(key)])) % 256
        S[i], S[j] = S[j], S[i]
    i = j = 0
    keystream = []
    while len(keystream) < length:
        i = (i + 1) % 256
        j = (j + S[i]) % 256
        S[i], S[j] = S[j], S[i]
        keystream.append(S[(S[i] + S[j]) % 256])
    return keystream

def try_keys():
    with open("/home/nelson/Documents/Cryprography/message.txt", "r") as f:
        encrypted_hex = f.read().strip()

    ciphertext = bytes.fromhex(encrypted_hex)
    for i in range(32):  # Try 32 possible short keys (e.g., "key", "key1", etc.)
        key = str(i)
        keystream = rc4_keystream(key, len(ciphertext))
        plaintext = ''.join(chr(ciphertext[j] ^ keystream[j]) for j in range(len(ciphertext)))

        # Try to identify meaningful output, here just printing a portion
        print(f"Key: {key}")
        print(f"Plaintext: {plaintext[:50]}...")  # Print first 50 chars of plaintext for inspection

try_keys()
