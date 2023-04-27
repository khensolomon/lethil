# Setup

```sh
# Create ecosystem.json
node run setup ecosystem

# Setup
pm2 deploy ecosystem.json production setup
# Update
pm2 deploy ecosystem.json production

# Upload .env
node run setup environment
