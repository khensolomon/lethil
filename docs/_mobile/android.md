---
title: "Android toolchain"
description: "JDK, command-line SDK, and emulator images without Android Studio."
category: "Mobile"
nav_order: 1
tags: [android, java, sdk, emulator]
---

Command-line only. Android Studio is never installed — `flutter doctor`
reporting `[!] Android Studio (not installed)` is expected and harmless, as
long as `[✓] Android toolchain` passes.

## JDK

```bash
sudo apt install -y openjdk-17-jdk

# Find the installed path
sudo update-alternatives --config java

echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
echo 'export PATH=$PATH:$JAVA_HOME/bin' >> ~/.bashrc
source ~/.bashrc

echo $JAVA_HOME && java -version
```

## SDK

```bash
mkdir -p ~/.sdk/android && cd ~/.sdk

# Check developer.android.com for the current URL before pasting
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip

echo 'export ANDROID_SDK="$HOME/.sdk/android"' >> ~/.bashrc
echo 'export PATH="$PATH:$ANDROID_SDK/cmdline-tools/bin"' >> ~/.bashrc
echo 'export PATH="$PATH:$ANDROID_SDK/platform-tools"' >> ~/.bashrc
source ~/.bashrc
```

## SDK components

```bash
sdkmanager --sdk_root=$ANDROID_SDK --licenses

sdkmanager --sdk_root=$ANDROID_SDK \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0" \
  "emulator" \
  "system-images;android-34;google_apis;x86_64"
```

Bump `android-34` and `34.0.0` to the current API level as needed.

## Emulator

Optional — only needed when not testing on a physical device.

```bash
avdmanager create avd -n flutter_emulator -k "system-images;android-34;google_apis;x86_64"
emulator -avd flutter_emulator
```
