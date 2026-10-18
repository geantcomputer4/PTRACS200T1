# My Fleet Tracker (Traccar backend + custom web app)

## Deploy on Coolify
1. Push this folder to a GitHub/GitLab repo.
2. Coolify > New Resource > Docker Compose (from your Git repo) > pick this repo.
3. Open the `web` service, set Domain to https://track.yourdomain.com (port 80).
4. Do NOT set a domain on `traccar`. Leave its port 5013 mapped (TCP + UDP).
5. Open port 5013 (TCP/UDP) in your VPS firewall.
6. Deploy.

## First use
1. Open your domain, click "Create account" (first account becomes admin).
2. Add device: ID 9175285171.
3. Send SMS to the tracker SIM (default password 123456):
   803123456 YOUR_APN
   804123456 YOUR_VPS_IP 5013
