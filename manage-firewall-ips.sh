#!/bin/bash
# Firewall IP Management Script
# Easily add/remove IPs for your dialer server

FIREWALL_RULES_FILE="/root/firewall-allowed-ips.txt"

# Function to show usage
show_usage() {
    echo "Usage: $0 [add|remove|list|reset|secure] [IP_ADDRESS]"
    echo ""
    echo "Commands:"
    echo "  add IP_ADDRESS    - Add an IP address to firewall"
    echo "  remove IP_ADDRESS - Remove an IP address from firewall"
    echo "  list              - List all allowed IPs"
    echo "  reset             - Remove all IP-based rules (keeps localhost)"
    echo "  secure            - Remove all 'Anywhere' rules (restrict to IPs only)"
    echo ""
    echo "Examples:"
    echo "  $0 add 139.135.39.43"
    echo "  $0 remove 139.135.39.43"
    echo "  $0 list"
    echo "  $0 secure"
}

# Function to add IP
add_ip() {
    local ip=$1
    
    if [ -z "$ip" ]; then
        echo "Error: IP address required"
        show_usage
        exit 1
    fi
    
    # Validate IP format (basic check)
    if ! [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "Error: Invalid IP address format"
        exit 1
    fi
    
    echo "Adding IP: $ip"
    
    # Add firewall rules for this IP
    sudo ufw allow from $ip to any port 22 proto tcp comment "SSH from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 8000 proto tcp comment "Backend API from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 3000 proto tcp comment "Frontend from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 5060 proto udp comment "SIP UDP from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 5060 proto tcp comment "SIP TCP from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 5038 proto tcp comment "AMI from $ip" 2>/dev/null
    sudo ufw allow from $ip to any port 10000:20000 proto udp comment "RTP from $ip" 2>/dev/null
    
    # Save IP to file
    echo "$ip" >> $FIREWALL_RULES_FILE
    sort -u $FIREWALL_RULES_FILE -o $FIREWALL_RULES_FILE
    
    echo "✓ IP $ip added successfully"
    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered | grep "$ip"
}

# Function to remove IP
remove_ip() {
    local ip=$1
    
    if [ -z "$ip" ]; then
        echo "Error: IP address required"
        show_usage
        exit 1
    fi
    
    echo "Removing IP: $ip"
    
    # Remove firewall rules for this IP
    sudo ufw delete allow from $ip to any port 22 proto tcp 2>/dev/null
    sudo ufw delete allow from $ip to any port 8000 proto tcp 2>/dev/null
    sudo ufw delete allow from $ip to any port 3000 proto tcp 2>/dev/null
    sudo ufw delete allow from $ip to any port 5060 proto udp 2>/dev/null
    sudo ufw delete allow from $ip to any port 5060 proto tcp 2>/dev/null
    sudo ufw delete allow from $ip to any port 5038 proto tcp 2>/dev/null
    sudo ufw delete allow from $ip to any port 10000:20000 proto udp 2>/dev/null
    
    # Remove IP from file
    if [ -f "$FIREWALL_RULES_FILE" ]; then
        grep -v "^$ip$" $FIREWALL_RULES_FILE > /tmp/firewall-ips.tmp
        mv /tmp/firewall-ips.tmp $FIREWALL_RULES_FILE
    fi
    
    echo "✓ IP $ip removed successfully"
}

# Function to list allowed IPs
list_ips() {
    echo "Allowed IPs:"
    echo "------------"
    if [ -f "$FIREWALL_RULES_FILE" ] && [ -s "$FIREWALL_RULES_FILE" ]; then
        cat $FIREWALL_RULES_FILE
    else
        echo "No IPs configured"
    fi
    echo ""
    echo "Current firewall rules:"
    sudo ufw status numbered | grep -E "(22|8000|3000|5060|5038|10000)" | head -20
}

# Function to reset (remove all IP rules, keep localhost)
reset_firewall() {
    echo "Removing all IP-based firewall rules..."
    
    if [ -f "$FIREWALL_RULES_FILE" ]; then
        while read ip; do
            [ -z "$ip" ] && continue
            remove_ip "$ip"
        done < $FIREWALL_RULES_FILE
    fi
    
    # Keep localhost rules
    sudo ufw allow from 127.0.0.1 to any port 5038 proto tcp 2>/dev/null
    sudo ufw allow from 127.0.0.1 to any port 5060 proto udp 2>/dev/null
    sudo ufw allow from 127.0.0.1 to any port 8000 proto tcp 2>/dev/null
    
    echo "✓ Firewall reset (localhost rules kept)"
}

# Function to secure firewall (remove all "Anywhere" rules)
secure_firewall() {
    echo "Removing all 'Anywhere' rules to restrict access to IPs only..."
    echo ""
    
    # Get numbered status
    local rules=$(sudo ufw status numbered | grep -E "\[.*\]" | grep -v "139.135.39.43\|127.0.0.1" | grep -E "(Anywhere|22|8000|3000|5060|5038|10000)" | awk '{print $1}' | sed 's/\[//;s/\]//' | sort -rn)
    
    if [ -z "$rules" ]; then
        echo "No open 'Anywhere' rules found. Firewall is already secure."
        return
    fi
    
    echo "Found open rules. Removing..."
    echo ""
    
    # Delete rules in reverse order (to preserve numbering)
    for rule_num in $rules; do
        echo "Removing rule $rule_num..."
        echo "y" | sudo ufw delete $rule_num > /dev/null 2>&1
    done
    
    echo ""
    echo "✓ All 'Anywhere' rules removed"
    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered | grep -E "(139.135.39.43|127.0.0.1|22|8000|3000|5060|5038|10000)"
}

# Initialize firewall rules file if it doesn't exist
if [ ! -f "$FIREWALL_RULES_FILE" ]; then
    touch $FIREWALL_RULES_FILE
fi

# Main command handler
case "$1" in
    add)
        add_ip "$2"
        ;;
    remove)
        remove_ip "$2"
        ;;
    list)
        list_ips
        ;;
    reset)
        read -p "Are you sure you want to remove all IP rules? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            reset_firewall
        else
            echo "Cancelled"
        fi
        ;;
    secure)
        read -p "This will remove all 'Anywhere' rules. Continue? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            secure_firewall
        else
            echo "Cancelled"
        fi
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
