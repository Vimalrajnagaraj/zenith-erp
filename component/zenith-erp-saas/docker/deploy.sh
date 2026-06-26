#!/bin/bash
# =============================================================================
# ZenithERP Production Deployment Script
# Usage: ./deploy.sh [init|start|stop|restart|logs|backup|ssl-init|ssl-renew|status]
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ZenithERP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

check_env() {
    if [ ! -f .env ]; then
        err ".env file not found. Copy .env.example to .env and configure it."
    fi
    source .env
    [ -z "$DB_PASSWORD" ] && err "DB_PASSWORD is not set in .env"
    [ -z "$CRYPT_PASS" ] && err "CRYPT_PASS is not set in .env"
}

case "${1:-help}" in
    init)
        log "Initializing ZenithERP production deployment..."
        check_env
        source .env

        log "Building application image..."
        docker compose build zenith

        log "Starting database..."
        docker compose up -d postgres
        sleep 5

        log "Starting application (first run will load seed data — this takes 2-3 minutes)..."
        docker compose up -d zenith
        log "Waiting for Moqui startup..."
        timeout=180
        while [ $timeout -gt 0 ]; do
            if docker exec zenith-app wget -q -O /dev/null http://localhost:8080/status 2>/dev/null; then
                log "Application is ready!"
                break
            fi
            sleep 5
            timeout=$((timeout - 5))
        done
        if [ $timeout -le 0 ]; then
            warn "Application may still be starting. Check: docker logs zenith-app"
        fi

        log "Starting nginx proxy..."
        docker compose up -d nginx

        log "Starting backup service..."
        docker compose up -d backup

        log "=== Deployment complete ==="
        log "HTTP:  http://${DOMAIN:-zenitherp.com}"
        log "Admin: http://${DOMAIN:-zenitherp.com}/vapps/zenith"
        log "Login: zenith.all / moqui"
        log ""
        log "Next steps:"
        log "  1. Run './deploy.sh ssl-init' to configure SSL"
        log "  2. Change default passwords via Settings > Users"
        log "  3. Configure Razorpay keys via SaaS Admin > Settings"
        log "  4. Configure SMTP for email notifications"
        ;;

    start)
        check_env
        log "Starting all services..."
        docker compose up -d
        log "Services started. Run './deploy.sh status' to check."
        ;;

    stop)
        log "Stopping all services..."
        docker compose down
        log "All services stopped. Data volumes are preserved."
        ;;

    restart)
        check_env
        log "Restarting all services..."
        docker compose down
        docker compose up -d
        log "Services restarted."
        ;;

    logs)
        SERVICE="${2:-zenith}"
        docker compose logs -f --tail=100 "$SERVICE"
        ;;

    status)
        log "Service status:"
        docker compose ps
        echo ""
        log "Disk usage:"
        docker system df
        echo ""
        if docker exec zenith-app wget -q -O /dev/null http://localhost:8080/status 2>/dev/null; then
            log "Application: ${GREEN}HEALTHY${NC}"
        else
            warn "Application: NOT RESPONDING"
        fi
        if docker exec zenith-db pg_isready -U zenith -d zenith_saas >/dev/null 2>&1; then
            log "Database: ${GREEN}HEALTHY${NC}"
        else
            warn "Database: NOT RESPONDING"
        fi
        BACKUP_COUNT=$(docker exec zenith-backup ls /backups/zenith_*.sql.gz 2>/dev/null | wc -l || echo 0)
        log "Backups: $BACKUP_COUNT file(s) in volume"
        ;;

    backup)
        log "Running manual backup..."
        docker exec zenith-backup /backup.sh
        ;;

    ssl-init)
        check_env
        source .env
        DOMAIN="${DOMAIN:-zenitherp.com}"
        EMAIL="${ADMIN_EMAIL:-admin@$DOMAIN}"

        log "Initializing SSL certificates for *.$DOMAIN..."

        # Ensure nginx is running with HTTP for ACME challenge
        docker compose up -d nginx

        log "Requesting certificate from Let's Encrypt..."
        docker compose run --rm certbot certonly \
            --webroot \
            --webroot-path /var/www/certbot \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN" \
            -d "*.$DOMAIN"

        # Copy certs to nginx volume
        docker compose exec certbot sh -c "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/certs/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/certs/"

        log "Reloading nginx with SSL..."
        docker compose exec nginx nginx -s reload

        log "SSL configured! Site available at https://$DOMAIN"
        ;;

    ssl-renew)
        log "Renewing SSL certificates..."
        docker compose run --rm certbot renew
        docker compose exec nginx nginx -s reload
        log "SSL renewal complete."
        ;;

    update)
        check_env
        log "Updating ZenithERP..."
        log "Building new image..."
        docker compose build zenith
        log "Rolling restart..."
        docker compose up -d zenith
        log "Waiting for startup..."
        sleep 30
        if docker exec zenith-app wget -q -O /dev/null http://localhost:8080/status 2>/dev/null; then
            log "Update complete — application is healthy."
        else
            warn "Application may still be starting. Check: ./deploy.sh logs"
        fi
        ;;

    help|*)
        echo "ZenithERP Production Deployment"
        echo ""
        echo "Usage: ./deploy.sh <command>"
        echo ""
        echo "Commands:"
        echo "  init        First-time setup (build, start all services, load seed data)"
        echo "  start       Start all services"
        echo "  stop        Stop all services (data preserved)"
        echo "  restart     Restart all services"
        echo "  update      Rebuild and restart the application"
        echo "  status      Show health status of all services"
        echo "  logs [svc]  Follow logs (default: zenith, options: postgres, nginx, backup)"
        echo "  backup      Run a manual database backup"
        echo "  ssl-init    Initialize Let's Encrypt SSL certificates"
        echo "  ssl-renew   Renew SSL certificates"
        echo ""
        echo "Setup:"
        echo "  1. cp .env.example .env"
        echo "  2. Edit .env with your production values"
        echo "  3. ./deploy.sh init"
        ;;
esac
