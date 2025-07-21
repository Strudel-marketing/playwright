#!/bin/bash

# Comprehensive test script for Playwright Universal Automation API
BASE_URL="http://localhost:3000"
if [ "$1" ]; then
    BASE_URL="$1"
fi

echo "🎭 Testing Playwright Universal Automation API at $BASE_URL"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    echo -e "\n${BLUE}Testing: $name${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if echo "$response" | jq -e ".$expected_field" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}: $name"
        ((TESTS_PASSED++))
        if [ "$VERBOSE" = "1" ]; then
            echo "$response" | jq ".$expected_field"
        fi
    else
        echo -e "${RED}❌ FAILED${NC}: $name"
        echo "Response: $response"
        ((TESTS_FAILED++))
    fi
}

echo -e "\n🔍 Running comprehensive API tests...\n"

# 1. Health Check
test_endpoint "Health Check" "GET" "/health" "" "status"

# 2. Comprehensive SEO Audit
test_endpoint "Comprehensive SEO Audit" "POST" "/api/seo/audit" \
    '{"url": "https://example.com", "detailed": true}' "result.score"

# 3. SEO Audit with Screenshot
test_endpoint "SEO Audit with Screenshot" "POST" "/api/seo/audit" \
    '{"url": "https://example.com", "includeScreenshot": true}' "result.screenshot"

# 4. Schema Extraction
test_endpoint "Schema Extraction" "POST" "/api/extract/schema" \
    '{"url": "https://schema.org/Product"}' "data.jsonLD"

# 5. Quick Schema Check
test_endpoint "Quick Schema Check" "POST" "/api/extract/quick-check" \
    '{"url": "https://schema.org/Product"}' "quickCheck.hasStructuredData"

# 6. Screenshot
test_endpoint "Screenshot" "POST" "/api/screenshot" \
    '{"url": "https://example.com", "options": {"fullPage": true}}' "result.filename"

# 7. Site Comparison
test_endpoint "Site Comparison" "POST" "/api/compare" \
    '{"urls": ["https://example.com", "https://httpbin.org"], "selectors": {"title": "title"}}' "result.comparison"

# 8. Download Test (without actual download)
test_endpoint "Download Endpoint Structure" "POST" "/api/download" \
    '{"url": "https://example.com"}' "error"

# 9. Available Sites
test_endpoint "Available Sites" "GET" "/api/sites" "" "sites"

# 10. Test Endpoint
test_endpoint "Basic Test" "POST" "/api/test" \
    '{"message": "hello world"}' "success"

# 11. Playwright Test
test_endpoint "Playwright Test" "POST" "/api/playwright-test" \
    '{}' "title"

echo -e "\n📊 Detailed SEO Analysis Test"
echo "=============================="

# Detailed SEO test with output
echo "Testing comprehensive SEO analysis on a real website..."
seo_response=$(curl -s -X POST "$BASE_URL/api/seo/audit" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://news.ycombinator.com", "detailed": true}')

if echo "$seo_response" | jq -e ".result.score" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SEO Analysis successful${NC}"
    echo ""
    echo "📈 SEO Score: $(echo "$seo_response" | jq -r '.result.score')/100"
    echo "🎯 Grade: $(echo "$seo_response" | jq -r '.result.grade')"
    echo "📋 Issues found: $(echo "$seo_response" | jq -r '.result.issues | length')"
    echo "💡 Recommendations: $(echo "$seo_response" | jq -r '.result.recommendations | length')"
    
    echo -e "\n🔍 Score Breakdown:"
    echo "$seo_response" | jq -r '.result.performance.scoreBreakdown | to_entries[] | "  \(.key): \(.value)/\(if .key == "content" then 30 elif .key == "technical" then 25 elif .key == "performance" then 20 elif .key == "mobile" then 10 elif .key == "social" then 8 else 7 end)"'
    
    echo -e "\n⚠️  Main Issues:"
    echo "$seo_response" | jq -r '.result.issues[] | "  - \(.)"' | head -5
    
    echo -e "\n💡 Top Recommendations:"
    echo "$seo_response" | jq -r '.result.recommendations[] | "  - \(.)"' | head -5
    
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ SEO Analysis failed${NC}"
    echo "Response: $seo_response"
    ((TESTS_FAILED++))
fi

echo -e "\n🎯 Schema Extraction Test"
echo "========================="

# Schema extraction test
schema_response=$(curl -s -X POST "$BASE_URL/api/extract/schema" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://www.amazon.com"}')

if echo "$schema_response" | jq -e ".data" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Schema extraction successful${NC}"
    echo ""
    echo "📊 JSON-LD schemas found: $(echo "$schema_response" | jq -r '.data.jsonLD | length')"
    echo "🏷️  Microdata items found: $(echo "$schema_response" | jq -r '.data.microdata | length')"
    echo "📱 Open Graph tags: $(echo "$schema_response" | jq -r '.data.openGraph | keys | length')"
    echo "🐦 Twitter Card tags: $(echo "$schema_response" | jq -r '.data.twitterCard | keys | length')"
    
    if echo "$schema_response" | jq -e ".data.jsonLD[0]" >/dev/null 2>&1; then
        echo -e "\n📋 First Schema Type:"
        echo "$schema_response" | jq -r '.data.jsonLD[0]["@type"] // "Unknown"'
    fi
    
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Schema extraction failed${NC}"
    echo "Response: $schema_response"
    ((TESTS_FAILED++))
fi

echo -e "\n⚡ Performance Test"
echo "=================="

# Performance test
echo "Testing response times..."
start_time=$(date +%s%N)
curl -s "$BASE_URL/health" >/dev/null
end_time=$(date +%s%N)
health_time=$(( (end_time - start_time) / 1000000 ))

start_time=$(date +%s%N)
curl -s -X POST "$BASE_URL/api/extract/quick-check" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}' >/dev/null
end_time=$(date +%s%N)
quick_time=$(( (end_time - start_time) / 1000000 ))

start_time=$(date +%s%N)
curl -s -X POST "$BASE_URL/api/seo/audit" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}' >/dev/null
end_time=$(date +%s%N)
seo_time=$(( (end_time - start_time) / 1000000 ))

echo "⏱️  Health check: ${health_time}ms"
echo "⏱️  Quick schema check: ${quick_time}ms"  
echo "⏱️  Full SEO audit: ${seo_time}ms"

if [ $health_time -lt 1000 ] && [ $quick_time -lt 10000 ] && [ $seo_time -lt 30000 ]; then
    echo -e "${GREEN}✅ Performance within acceptable limits${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Some endpoints are slower than expected${NC}"
    ((TESTS_FAILED++))
fi

echo -e "\n🎯 Feature Coverage Test"
echo "========================"

# Test feature availability
features_response=$(curl -s "$BASE_URL/health")
if echo "$features_response" | jq -e ".features" >/dev/null 2>&1; then
    echo "📋 Available features:"
    echo "$features_response" | jq -r '.features[] | "  ✓ \(.)"'
    
    expected_features=("comprehensive-seo-analysis" "structured-data-extraction" "performance-monitoring" "screenshots")
    missing_features=()
    
    for feature in "${expected_features[@]}"; do
        if ! echo "$features_response" | jq -e ".features | index(\"$feature\")" >/dev/null 2>&1; then
            missing_features+=("$feature")
        fi
    done
    
    if [ ${#missing_features[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All expected features available${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  Missing features: ${missing_features[*]}${NC}"
        ((TESTS_FAILED++))
    fi
fi

# Final Summary
echo -e "\n" "="*60
echo -e "\n📊 TEST SUMMARY"
echo "==============="
echo -e "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! API is working correctly.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
