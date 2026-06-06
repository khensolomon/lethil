# Todo

```bash
cd ~/
curl -O https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/setup.py
# python3 setup.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/disks.py
# python3 disks.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/plex.py
# python3 plex.py
curl -O https://raw.githubusercontent.com/khensolomon/lethil/refs/heads/master/me/media/transmission.py
# sudo python3 transmission.py --apply

python ~/dev/lethil/me/fetch.py
```

## SSH

```bash
# Check if the SSH service is running (
sudo systemctl status ssh

# Install if not present
sudo apt update && sudo apt install openssh-server -y
# Enable and start the service
sudo systemctl enable --now ssh
```

## Fix Remote Desktop (RDP) For Headless

```bash
sudo apt install xrdp
sudo systemctl enable xrdp
```

## Ensure Plex Starts on Boot System-Wide

```bash
# Plex should ideally run as a system daemon (systemd), meaning it starts before any user logs in. If it isn't doing that, we need to enable it.
sudo systemctl enable plexmediaserver.service
sudo systemctl start plexmediaserver.service
```

## Run Transmission as a Daemon

```bash
# Install Transmission Daemon (if not already installed)
sudo apt update
sudo apt install transmission-daemon -y


# Start it now
sudo systemctl start transmission-daemon

# Enable it to start automatically on boot
sudo systemctl enable transmission-daemon
sudo systemctl status transmission-daemon


# sudo nano /etc/transmission-daemon/settings.json
sudo systemctl stop transmission-daemon
sudo nano /var/lib/transmission-daemon/.config/transmission/settings.json
sudo systemctl restart transmission-daemon
```

## The Physical Power Button

```bash
# Open the login manager settings or handle it via acpid (Advanced Configuration and Power Interface). The cleanest way in modern Ubuntu is via logind:
sudo nano /etc/systemd/logind.conf
# Find the line #HandlePowerKey=poweroff (it might be set to suspend or commented out).
HandlePowerKey=poweroff
# Save the file and restart the systemd-logind service to apply it:
sudo systemctl restart systemd-logind
```

```bash
...
```
