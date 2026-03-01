#!/bin/bash

# Practice 1 - Automated Grading Script
# This script tests the student's Node-RED flow implementation

set -e

# Configuration
NODE_RED_URL="${NODE_RED_URL:-http://localhost:1880}"
DOWNSTREAM_API_URL="${DOWNSTREAM_API_URL:-http://localhost:3001}"
PRICING_API_URL="${PRICING_API_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
declare -a TEST_NAMES
declare -a TEST_RESULTS
declare -a TEST_SCORES
TOTAL_SCORE=0

# Function to print test result
print_result() {
  local test_num=$1
  local test_name=$2
  local result=$3
  local score=$4
  
  TEST_NAMES+=("$test_name")
  TEST_RESULTS+=("$result")
  TEST_SCORES+=("$score")
  
  if [ "$result" == "PASS" ]; then
    TOTAL_SCORE=$(echo "$TOTAL_SCORE + $score" | bc)
    echo -e "${GREEN}[$test_num] $test_name${NC} - ${GREEN}PASS ($score pts)${NC}"
  else
    echo -e "${RED}[$test_num] $test_name${NC} - ${RED}FAIL (0 pts)${NC}"
  fi
}

# Function to check if services are running
check_services() {
  echo "Checking if services are running..."
  
  # Check Node-RED
  if ! curl -s -f "$NODE_RED_URL/hello" > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Node-RED /hello endpoint not responding${NC}"
  fi
  
  # Check downstream API
  if ! curl -s -f "$DOWNSTREAM_API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Downstream API is not running${NC}"
    exit 1
  fi
  
  # Check pricing API
  if ! curl -s -f "$PRICING_API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Pricing API is not running${NC}"
    exit 1
  fi
  
  echo "Services are running."
}

# Function to reset downstream orders
reset_downstream() {
  curl -s -X DELETE "$DOWNSTREAM_API_URL/downstream/standard/orders" > /dev/null 2>&1 || true
  curl -s -X DELETE "$DOWNSTREAM_API_URL/downstream/express/orders" > /dev/null 2>&1 || true
  curl -s -X DELETE "$DOWNSTREAM_API_URL/downstream/b2b/orders" > /dev/null 2>&1 || true
}

# Function to send order and get downstream result
send_and_verify() {
  local endpoint=$1
  local data_file=$2
  local downstream_type=$3
  
  # Read the data file
  local data
  data=$(cat "$data_file")
  
  # Send to Node-RED
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$data" \
    "$NODE_RED_URL$endpoint" 2>&1)
  
  local http_code
  http_code=$(echo "$response" | tail -n1)
  
  # Check if request was accepted (not 500)
  if [ "$http_code" == "500" ]; then
    return 1
  fi
  
  # Wait a moment for processing
  sleep 1
  
  # Get the last order from downstream
  local downstream_response
  downstream_response=$(curl -s "$DOWNSTREAM_API_URL/downstream/$downstream_type/orders")
  
  # Check if we got valid orders
  if [ -z "$downstream_response" ] || [ "$downstream_response" == "[]" ]; then
    return 1
  fi
  
  echo "$downstream_response"
  return 0
}

# Function to validate pricing enrichment
check_pricing() {
  local order_json=$1
  
  # Check if unitPrice and taxRate are present in items
  echo "$order_json" | grep -q '"unitPrice"' && \
  echo "$order_json" | grep -q '"taxRate"' && \
  echo "$order_json" | grep -q '"currency"'
  
  return $?
}

echo "============================================"
echo "Practice 1 - Automated Test Suite"
echo "============================================"
echo ""

# Check services
check_services
echo ""

# Reset downstream orders
echo "Resetting downstream orders..."
reset_downstream
echo ""

# Test 1: Web order routing + transformation
echo "Test 1: Web order routing + transformation"
if send_and_verify "/order/web" "$PROJECT_DIR/test-data/web-order.json" "standard" > /dev/null 2>&1; then
  print_result "1" "Web order routing + transformation" "PASS" "4"
else
  print_result "1" "Web order routing + transformation" "FAIL" "0"
fi

# Reset for next test
reset_downstream

# Test 2: Mobile order routing + transformation
echo "Test 2: Mobile order routing + transformation"
if send_and_verify "/order/mobile" "$PROJECT_DIR/test-data/mobile-order.json" "express" > /dev/null 2>&1; then
  print_result "2" "Mobile order routing + transformation" "PASS" "4"
else
  print_result "2" "Mobile order routing + transformation" "FAIL" "0"
fi

# Reset for next test
reset_downstream

# Test 3: B2B order routing + transformation
echo "Test 3: B2B order routing + transformation"
if send_and_verify "/order/b2b" "$PROJECT_DIR/test-data/b2b-order.xml" "b2b" > /dev/null 2>&1; then
  print_result "3" "B2B order routing + transformation" "PASS" "4"
else
  print_result "3" "B2B order routing + transformation" "FAIL" "0"
fi

echo ""

# Test 4: Unknown orderType handling
echo "Test 4: Unknown orderType handling"
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"orderType":"wholesale"}' \
  "$NODE_RED_URL/order/web" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" != "500" ]; then
  print_result "4" "Unknown orderType handling" "PASS" "1.5"
else
  print_result "4" "Unknown orderType handling" "FAIL" "0"
fi

# Test 5: Malformed JSON handling
echo "Test 5: Malformed JSON handling"
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  --data-raw '{"orderId":"TEST","orderType":"standard" "invalid":true' \
  "$NODE_RED_URL/order/web" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" != "500" ]; then
  print_result "5" "Malformed JSON handling" "PASS" "1.5"
else
  print_result "5" "Malformed JSON handling" "FAIL" "0"
fi

# Test 6: Empty body handling
echo "Test 6: Empty body handling"
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '' \
  "$NODE_RED_URL/order/mobile" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" != "500" ]; then
  print_result "6" "Empty body handling" "PASS" "1.5"
else
  print_result "6" "Empty body handling" "FAIL" "0"
fi

# Test 7: Unknown product ID handling
echo "Test 7: Unknown product ID handling"
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST","orderType":"standard","customer":{"name":"Test","email":"test@test.com","address":{"street":"1","city":"C","postalCode":"1","country":"TC"}},"items":[{"productId":"PROD-999","quantity":1}],"currency":"EUR","status":"new"}' \
  "$NODE_RED_URL/order/web" 2>&1)
http_code=$(echo "$response" | tail -n1)
# Graceful handling means either error response OR order without pricing
if [ "$http_code" != "500" ]; then
  print_result "7" "Unknown product ID handling" "PASS" "1.5"
else
  print_result "7" "Unknown product ID handling" "FAIL" "0"
fi

# Test 8: Missing required field handling
echo "Test 8: Missing required field handling"
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST","orderType":"standard","customer":{"email":"test@test.com","address":{"street":"1","city":"C","postalCode":"1","country":"TC"}},"items":[{"productId":"PROD-001","quantity":1}],"currency":"EUR","status":"new"}' \
  "$NODE_RED_URL/order/web" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" != "500" ]; then
  print_result "8" "Missing required field handling" "PASS" "1.5"
else
  print_result "8" "Missing required field handling" "FAIL" "0"
fi

# Test 9: Flow deploys without errors
echo "Test 9: Flow deploys without errors"
response=$(curl -s -w "\n%{http_code}" "$NODE_RED_URL/hello" 2>&1)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" == "200" ]; then
  print_result "9" "Flow deploys without errors" "PASS" "3"
else
  print_result "9" "Flow deploys without errors" "FAIL" "0"
fi

# Print summary
echo ""
echo "============================================"
echo "Test Summary"
echo "============================================"
printf "%-4s %-45s %-15s\n" "#" "Test Case" "Result"
echo "--------------------------------------------"

for i in "${!TEST_NAMES[@]}"; do
  num=$((i+1))
  printf "%-4d %-45s %-15s\n" "$num" "${TEST_NAMES[$i]}" "${TEST_RESULTS[$i]}"
done

echo "--------------------------------------------"
echo "Automated Score: $TOTAL_SCORE / 17"
echo "(README quality: 3 pts — graded manually)"
echo "============================================"
