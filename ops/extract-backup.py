#!/usr/bin/env python3
"""Validate and extract only a Word Atlas database/audio archive, never links."""
import hashlib
import pathlib
import re
import sys
import tarfile

archive, output = map(pathlib.Path, sys.argv[1:])
with tarfile.open(archive, 'r:') as tar:
    members = tar.getmembers()
    names = set()
    for member in members:
        allowed = member.name in ('database.dump', 'manifest.txt', 'audio', 'audio/') or re.fullmatch(r'audio/[a-f0-9]{64}\.(mp3|pending\.mp3|source\.mp3|source\.wav)', member.name)
        if not allowed or member.name in names or not (member.isfile() or member.isdir() and member.name in ('audio', 'audio/')):
            raise SystemExit('Refusing unexpected archive member/type')
        names.add(member.name)
    if not {'database.dump', 'manifest.txt'}.issubset(names):
        raise SystemExit('Backup is incomplete')
    # All paths/types were checked; output is a freshly created private directory.
    for member in members:
        target = output / member.name
        if member.isdir():
            target.mkdir(exist_ok=True, mode=0o700)
        else:
            target.parent.mkdir(exist_ok=True, mode=0o700)
            with tar.extractfile(member) as source, target.open('xb') as dest:
                while chunk := source.read(1024 * 1024):
                    dest.write(chunk)
            target.chmod(0o600)
manifest = (output / 'manifest.txt').read_text()
expected = re.search(r'^([a-f0-9]{64})\s+.+database.dump$', manifest, re.M)
if not expected:
    raise SystemExit('Database checksum missing')
hash_value = hashlib.sha256()
with (output / 'database.dump').open('rb') as stream:
    while chunk := stream.read(1024 * 1024):
        hash_value.update(chunk)
if hash_value.hexdigest() != expected[1]:
    raise SystemExit('Database checksum does not match')
print('Archive paths, regular file types and database checksum verified.')
