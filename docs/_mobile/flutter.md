---
title: "Flutter"
description: "Flutter SDK on top of the command-line Android toolchain."
category: "Mobile"
nav_order: 2
tags: [toolchain, android]
---

Requires the JDK and SDK from [[Android toolchain]].

```bash
sudo apt update
sudo apt install -y curl git unzip xz-utils zip libglu1-mesa

cd ~/.sdk
# Check docs.flutter.dev for the current stable version before pasting — this
# URL is pinned and will 404 once 3.35.6 is rotated out.
curl -O https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.35.6-stable.tar.xz
tar xf flutter_linux_3.35.6-stable.tar.xz

echo 'export PATH="$PATH:$HOME/.sdk/flutter/bin"' >> ~/.bashrc
source ~/.bashrc
```

## Connect to the Android SDK

```bash
flutter doctor --android-licenses
flutter config --android-sdk $ANDROID_SDK
flutter doctor -v
```
