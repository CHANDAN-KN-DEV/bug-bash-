-- ============================================================================
-- BUG BASH ARENA: Seed Data (Admin, Students, Rounds, Programs, Solutions)
-- ============================================================================

-- Fixed UUIDs for predictable testing and seeding
DO $$
DECLARE
    -- Admin UUID
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    
    -- Student UUIDs
    v_alice_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_bob_id   UUID := 'b0000000-0000-0000-0000-000000000002';
    v_charlie_id UUID := 'b0000000-0000-0000-0000-000000000003';
    v_diana_id UUID := 'b0000000-0000-0000-0000-000000000004';
    v_ethan_id UUID := 'b0000000-0000-0000-0000-000000000005';

    -- Round UUIDs
    v_r1_id UUID := 'c1111111-1111-1111-1111-111111111111';
    v_r2_id UUID := 'c2222222-2222-2222-2222-222222222222';
    v_r3_id UUID := 'c3333333-3333-3333-3333-333333333333';

    -- Program UUIDs Round 1
    v_p1_1 UUID := 'd1000000-0000-0000-0000-000000000001';
    v_p1_2 UUID := 'd1000000-0000-0000-0000-000000000002';
    v_p1_3 UUID := 'd1000000-0000-0000-0000-000000000003';
    v_p1_4 UUID := 'd1000000-0000-0000-0000-000000000004';
    v_p1_5 UUID := 'd1000000-0000-0000-0000-000000000005';
    v_p1_6 UUID := 'd1000000-0000-0000-0000-000000000006';
    v_p1_7 UUID := 'd1000000-0000-0000-0000-000000000007';
    v_p1_8 UUID := 'd1000000-0000-0000-0000-000000000008';
    v_p1_9 UUID := 'd1000000-0000-0000-0000-000000000009';
    v_p1_10 UUID := 'd1000000-0000-0000-0000-000000000010';

    -- Program UUIDs Round 2
    v_p2_1 UUID := 'd2000000-0000-0000-0000-000000000001';
    v_p2_2 UUID := 'd2000000-0000-0000-0000-000000000002';
    v_p2_3 UUID := 'd2000000-0000-0000-0000-000000000003';
    v_p2_4 UUID := 'd2000000-0000-0000-0000-000000000004';
    v_p2_5 UUID := 'd2000000-0000-0000-0000-000000000005';

    -- Program UUIDs Round 3
    v_p3_1 UUID := 'd3000000-0000-0000-0000-000000000001';
    v_p3_2 UUID := 'd3000000-0000-0000-0000-000000000002';

BEGIN
    -- 1. Insert rounds
    INSERT INTO public.rounds (id, round_number, name, description, duration_minutes, status, started_at)
    VALUES 
    (v_r1_id, 1, 'Round 1: Rapid Bug Hunting', 'Ten core programmatic defects in fundamental algorithms. Solve all 10 programs before the 30-minute timer expires.', 30, 'live', timezone('utc'::text, now())),
    (v_r2_id, 2, 'Round 2: Algorithmic & Structural Flaws', 'Five intermediate algorithmic bottlenecks, graph anomalies, and cache coherence bugs.', 30, 'ready', NULL),
    (v_r3_id, 3, 'Round 3: System Resilience & Concurrency', 'Two complex multi-threaded concurrency traps and distributed lease failure states.', 45, 'draft', NULL)
    ON CONFLICT (id) DO UPDATE 
    SET name = EXCLUDED.name, description = EXCLUDED.description, duration_minutes = EXCLUDED.duration_minutes, status = EXCLUDED.status;

    -- 2. Insert Round 1 Programs (10 programs)
    -- Program 1
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_1, v_r1_id, 'Binary Search Boundary Bug', 'python',
        'Find the target element in a sorted list. The current implementation has an off-by-one bug causing infinite loops or missing endpoints.',
        'def binary_search(arr, target):
    low = 0
    high = len(arr) # BUG: should be len(arr) - 1

    while low < high: # BUG: misses single element when low == high
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid # BUG: causes infinite loop when low and mid meet
        else:
            high = mid
            
    return -1', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_1,
        'def binary_search(arr, target):
    low = 0
    high = len(arr) - 1

    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
            
    return -1'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 2
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_2, v_r1_id, 'Two Sum Duplicate Index', 'javascript',
        'Find indices of two numbers that add up to the target. The current code allows using the exact same element twice.',
        'function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        map.set(nums[i], i);
    }
    
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        // BUG: map.has(complement) might return the same index i!
        if (map.has(complement)) {
            return [i, map.get(complement)];
        }
    }
    return [];
}', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_2,
        'function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 3
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_3, v_r1_id, 'Valid Palindrome Non-Alphanumeric', 'python',
        'Check if a string is a palindrome considering only alphanumeric characters and ignoring cases.',
        'def is_palindrome(s: str) -> bool:
    # BUG: Does not filter non-alphanumeric characters and lowercase!
    left = 0
    right = len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_3,
        'def is_palindrome(s: str) -> bool:
    clean = "".join(ch.lower() for ch in s if ch.isalnum())
    return clean == clean[::-1]'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 4
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_4, v_r1_id, 'Object Mutation in Deep Clone', 'javascript',
        'Perform a safe clone of nested config objects without mutating original references.',
        'function updateConfig(originalConfig, newKey, newValue) {
    // BUG: Object.assign or spread performs shallow copy only!
    const updated = { ...originalConfig };
    updated.database.host = newValue; 
    return updated;
}', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_4,
        'function updateConfig(originalConfig, newKey, newValue) {
    const updated = JSON.parse(JSON.stringify(originalConfig));
    if (updated.database) {
        updated.database[newKey] = newValue;
    }
    return updated;
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 5
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_5, v_r1_id, 'Linked List Node Deletion', 'cpp',
        'Delete the first occurrence of a value in a singly linked list without leaking memory or dereferencing null pointers.',
        'struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* deleteNode(ListNode* head, int target) {
    if (!head) return nullptr;
    if (head->val == target) {
        ListNode* temp = head->next;
        delete head;
        return temp;
    }
    ListNode* curr = head;
    // BUG: Accessing curr->next->val without checking if curr->next is nullptr
    while (curr->next->val != target) {
        curr = curr->next;
    }
    ListNode* toDelete = curr->next;
    curr->next = curr->next->next;
    delete toDelete;
    return head;
}', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_5,
        'ListNode* deleteNode(ListNode* head, int target) {
    if (!head) return nullptr;
    if (head->val == target) {
        ListNode* temp = head->next;
        delete head;
        return temp;
    }
    ListNode* curr = head;
    while (curr->next && curr->next->val != target) {
        curr = curr->next;
    }
    if (curr->next) {
        ListNode* toDelete = curr->next;
        curr->next = curr->next->next;
        delete toDelete;
    }
    return head;
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 6
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_6, v_r1_id, 'Fibonacci Memoization Base Case', 'python',
        'Calculate the nth Fibonacci number efficiently. Current code has inverted base cases causing recursion depth limit exhaustion.',
        'def fib(n, memo={}):
    # BUG: mutable default argument memo={} and wrong base cases
    if n == 0:
        return 1 # BUG: fib(0) is 0
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_6,
        'def fib(n, memo=None):
    if memo is None:
        memo = {}
    if n <= 0:
        return 0
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 7
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_7, v_r1_id, 'Merge Sorted Arrays Pointer Drop', 'python',
        'Merge two sorted arrays into one sorted result. The code currently stops prematurely if array lengths differ.',
        'def merge_sorted(a, b):
    result = []
    i = 0
    j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            result.append(a[i])
            i += 1
        else:
            result.append(b[j])
            j += 1
    # BUG: Forgot to append remaining elements of whichever list is not exhausted!
    return result', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_7,
        'def merge_sorted(a, b):
    result = []
    i = 0
    j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            result.append(a[i])
            i += 1
        else:
            result.append(b[j])
            j += 1
    result.extend(a[i:])
    result.extend(b[j:])
    return result'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 8
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_8, v_r1_id, 'Anagram Case & Whitespace Bug', 'javascript',
        'Verify if two strings are valid anagrams regardless of letter case or spaces.',
        'function isAnagram(s1, s2) {
    // BUG: Does not remove spaces or handle uppercase/lowercase
    return s1.split("").sort().join("") === s2.split("").sort().join("");
}', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_8,
        'function isAnagram(s1, s2) {
    const clean = str => str.toLowerCase().replace(/[^a-z0-9]/g, "").split("").sort().join("");
    return clean(s1) === clean(s2);
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 9
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_9, v_r1_id, 'String Atoi Sign & Overflow', 'java',
        'Parse a string to a 32-bit signed integer. The current code ignores negative sign prefix and overflows on boundary values.',
        'public class Solution {
    public static int myAtoi(String str) {
        if (str == null || str.trim().isEmpty()) return 0;
        str = str.trim();
        long result = 0;
        // BUG: Does not handle positive/negative signs (+ or -)
        for (int i = 0; i < str.length(); i++) {
            char ch = str.charAt(i);
            if (!Character.isDigit(ch)) break;
            result = result * 10 + (ch - ''0'');
            // BUG: No 32-bit signed integer clamp (Integer.MIN_VALUE to Integer.MAX_VALUE)
        }
        return (int) result;
    }
}', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_9,
        'public class Solution {
    public static int myAtoi(String str) {
        if (str == null || str.trim().isEmpty()) return 0;
        str = str.trim();
        int sign = 1;
        int i = 0;
        if (str.charAt(0) == ''-'') {
            sign = -1;
            i++;
        } else if (str.charAt(0) == ''+'') {
            i++;
        }
        long result = 0;
        while (i < str.length() && Character.isDigit(str.charAt(i))) {
            result = result * 10 + (str.charAt(i) - ''0'');
            if (sign == 1 && result > Integer.MAX_VALUE) return Integer.MAX_VALUE;
            if (sign == -1 && -result < Integer.MIN_VALUE) return Integer.MIN_VALUE;
            i++;
        }
        return (int) (sign * result);
    }
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- Program 10
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES (
        v_p1_10, v_r1_id, 'Sliding Window Average', 'python',
        'Compute sliding window moving averages for an array of numbers with window size k.',
        'def sliding_window_avg(nums, k):
    if not nums or k <= 0 or k > len(nums):
        return []
    result = []
    # BUG: Recalculates sum from scratch each time, or off-by-one window bounds
    for i in range(len(nums) - k): # BUG: misses the last window (should be len(nums) - k + 1)
        window = nums[i : i + k]
        result.append(sum(window) / k)
    return result', 10
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES (
        v_p1_10,
        'def sliding_window_avg(nums, k):
    if not nums or k <= 0 or k > len(nums):
        return []
    result = []
    window_sum = sum(nums[:k])
    result.append(window_sum / k)
    
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        result.append(window_sum / k)
    return result'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- 3. Insert Round 2 Programs (5 programs)
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES 
    (
        v_p2_1, v_r2_id, 'Dijkstra Priority Queue Loop', 'python',
        'Shortest path computation using Dijkstra algorithm. Missing relaxation check causes exponential duplicate state exploration.',
        'import heapq

def dijkstra(graph, start):
    distances = {node: float("inf") for node in graph}
    distances[start] = 0
    pq = [(0, start)]

    while pq:
        curr_dist, u = heapq.heappop(pq)
        # BUG: Missing if curr_dist > distances[u]: continue!
        # Causes outdated paths to be re-explored repeatedly
        for v, weight in graph[u].items():
            dist = curr_dist + weight
            if dist < distances[v]:
                distances[v] = dist
                heapq.heappush(pq, (dist, v))
                
    return distances', 20
    ),
    (
        v_p2_2, v_r2_id, 'LRU Cache Eviction Node Unlink', 'javascript',
        'Doubly linked list LRU cache eviction logic drops the wrong pointer during node eviction.',
        'class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
    }
    get(key) {
        if (!this.map.has(key)) return -1;
        const val = this.map.get(key);
        // BUG: In JavaScript Map, re-inserting is needed to maintain LRU order,
        // but current code does not delete and re-set!
        return val;
    }
    put(key, val) {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.capacity) {
            // BUG: Evicts newest item instead of oldest!
            const keys = Array.from(this.map.keys());
            this.map.delete(keys[keys.length - 1]);
        }
        this.map.set(key, val);
    }
}', 20
    ),
    (
        v_p2_3, v_r2_id, 'Validate Binary Search Tree', 'python',
        'Verify if a binary tree is a valid BST. Checking only immediate children values allows invalid deeper ancestors.',
        'class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def is_valid_bst(root):
    if not root:
        return True
    # BUG: Only validates immediate left and right child, not entire subtree bounds!
    if root.left and root.left.val >= root.val:
        return False
    if root.right and root.right.val <= root.val:
        return False
    return is_valid_bst(root.left) and is_valid_bst(root.right)', 20
    ),
    (
        v_p2_4, v_r2_id, 'Matrix Spiral Traversal Edge Overwrite', 'cpp',
        'Traverse an M x N 2D matrix in spiral order. Edge condition causes duplicate row/column reads on non-square matrices.',
        '#include <vector>
using namespace std;

vector<int> spiralOrder(vector<vector<int>>& matrix) {
    vector<int> res;
    if (matrix.empty()) return res;
    int top = 0, bottom = matrix.size() - 1;
    int left = 0, right = matrix[0].size() - 1;

    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) res.push_back(matrix[top][j]);
        top++;
        for (int i = top; i <= bottom; i++) res.push_back(matrix[i][right]);
        right--;
        // BUG: Missing check if (top <= bottom) before reading bottom row!
        for (int j = right; j >= left; j--) res.push_back(matrix[bottom][j]);
        bottom--;
        // BUG: Missing check if (left <= right) before reading left column!
        for (int i = bottom; i >= top; i--) res.push_back(matrix[i][left]);
        left++;
    }
    return res;
}', 20
    ),
    (
        v_p2_5, v_r2_id, 'Token Bucket Rate Limiter Refill', 'java',
        'Token bucket rate limiter rate calculation drops fractional tokens and bursts over capacity.',
        'public class RateLimiter {
    private final long capacity;
    private final double refillRatePerSecond;
    private double currentTokens;
    private long lastRefillTimestamp;

    public RateLimiter(long capacity, double refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRatePerSecond = refillRatePerSecond;
        this.currentTokens = capacity;
        this.lastRefillTimestamp = System.currentTimeMillis();
    }

    public synchronized boolean allowRequest(int tokens) {
        long now = System.currentTimeMillis();
        // BUG: (now - lastRefillTimestamp) in milliseconds divided as integer or wrong unit scale
        long elapsedMillis = now - lastRefillTimestamp;
        double addedTokens = (elapsedMillis / 1000) * refillRatePerSecond; // integer division truncation!
        currentTokens = Math.min(capacity, currentTokens + addedTokens);
        lastRefillTimestamp = now;

        if (currentTokens >= tokens) {
            currentTokens -= tokens;
            return true;
        }
        return false;
    }
}', 20
    ) ON CONFLICT (id) DO NOTHING;

    -- Solutions for Round 2
    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES 
    (
        v_p2_1,
        'import heapq

def dijkstra(graph, start):
    distances = {node: float("inf") for node in graph}
    distances[start] = 0
    pq = [(0, start)]

    while pq:
        curr_dist, u = heapq.heappop(pq)
        if curr_dist > distances[u]:
            continue
        for v, weight in graph[u].items():
            dist = curr_dist + weight
            if dist < distances[v]:
                distances[v] = dist
                heapq.heappush(pq, (dist, v))
                
    return distances'
    ),
    (
        v_p2_2,
        'class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
    }
    get(key) {
        if (!this.map.has(key)) return -1;
        const val = this.map.get(key);
        this.map.delete(key);
        this.map.set(key, val);
        return val;
    }
    put(key, val) {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.capacity) {
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
        this.map.set(key, val);
    }
}'
    ),
    (
        v_p2_3,
        'def is_valid_bst(root, min_val=float("-inf"), max_val=float("inf")):
    if not root:
        return True
    if not (min_val < root.val < max_val):
        return False
    return (is_valid_bst(root.left, min_val, root.val) and 
            is_valid_bst(root.right, root.val, max_val))'
    ),
    (
        v_p2_4,
        '#include <vector>
using namespace std;

vector<int> spiralOrder(vector<vector<int>>& matrix) {
    vector<int> res;
    if (matrix.empty()) return res;
    int top = 0, bottom = matrix.size() - 1;
    int left = 0, right = matrix[0].size() - 1;

    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) res.push_back(matrix[top][j]);
        top++;
        for (int i = top; i <= bottom; i++) res.push_back(matrix[i][right]);
        right--;
        if (top <= bottom) {
            for (int j = right; j >= left; j--) res.push_back(matrix[bottom][j]);
            bottom--;
        }
        if (left <= right) {
            for (int i = bottom; i >= top; i--) res.push_back(matrix[i][left]);
            left++;
        }
    }
    return res;
}'
    ),
    (
        v_p2_5,
        'public class RateLimiter {
    private final long capacity;
    private final double refillRatePerSecond;
    private double currentTokens;
    private long lastRefillTimestamp;

    public RateLimiter(long capacity, double refillRatePerSecond) {
        this.capacity = capacity;
        this.refillRatePerSecond = refillRatePerSecond;
        this.currentTokens = capacity;
        this.lastRefillTimestamp = System.currentTimeMillis();
    }

    public synchronized boolean allowRequest(int tokens) {
        long now = System.currentTimeMillis();
        double elapsedSeconds = (now - lastRefillTimestamp) / 1000.0;
        double addedTokens = elapsedSeconds * refillRatePerSecond;
        currentTokens = Math.min(capacity, currentTokens + addedTokens);
        lastRefillTimestamp = now;

        if (currentTokens >= tokens) {
            currentTokens -= tokens;
            return true;
        }
        return false;
    }
}'
    ) ON CONFLICT (program_id) DO NOTHING;

    -- 4. Insert Round 3 Programs (2 programs)
    INSERT INTO public.programs (id, round_id, title, language, description, buggy_code, points)
    VALUES 
    (
        v_p3_1, v_r3_id, 'Distributed Lock Lease Expiry Race Condition', 'python',
        'Redis distributed lock implementation. Releasing lock without checking token allows a slow client to release a lock newly acquired by another worker.',
        'import time

class RedisDistributedLock:
    def __init__(self, redis_client, resource_key, ttl_seconds=10):
        self.redis = redis_client
        self.key = resource_key
        self.ttl = ttl_seconds
        self.lock_token = None

    def acquire(self):
        import uuid
        self.lock_token = str(uuid.uuid4())
        # SET key token NX EX ttl
        return self.redis.set(self.key, self.lock_token, nx=True, ex=self.ttl)

    def release(self):
        # BUG: Blindly deleting key deletes lock even if TTL expired
        # and another process now owns the lock with a different token!
        return self.redis.delete(self.key)', 50
    ),
    (
        v_p3_2, v_r3_id, 'Promise Concurrency Pool Deadlock', 'javascript',
        'A concurrency limiter that executes tasks with at most N concurrent operations. Rejection in any task halts the queue.',
        'async function promisePool(tasks, limit) {
    const results = [];
    const executing = new Set();
    
    for (const [index, task] of tasks.entries()) {
        const p = Promise.resolve().then(task).then(res => {
            results[index] = res;
            executing.delete(p);
        }); // BUG: Missing .catch() or finally handler! If task rejects, executing is never deleted and pool hangs forever
        executing.add(p);
        
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}', 50
    ) ON CONFLICT (id) DO NOTHING;

    -- Solutions for Round 3
    INSERT INTO public.program_solutions (program_id, reference_solution)
    VALUES 
    (
        v_p3_1,
        'class RedisDistributedLock:
    def __init__(self, redis_client, resource_key, ttl_seconds=10):
        self.redis = redis_client
        self.key = resource_key
        self.ttl = ttl_seconds
        self.lock_token = None

    def acquire(self):
        import uuid
        self.lock_token = str(uuid.uuid4())
        return self.redis.set(self.key, self.lock_token, nx=True, ex=self.ttl)

    def release(self):
        # Safe release using atomic Lua script checking matching token
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        return self.redis.eval(lua_script, 1, self.key, self.lock_token)'
    ),
    (
        v_p3_2,
        'async function promisePool(tasks, limit) {
    const results = [];
    const executing = new Set();
    
    for (const [index, task] of tasks.entries()) {
        const p = Promise.resolve()
            .then(task)
            .then(res => { results[index] = { status: "fulfilled", value: res }; })
            .catch(err => { results[index] = { status: "rejected", reason: err }; })
            .finally(() => { executing.delete(p); });
            
        executing.add(p);
        
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.allSettled(Array.from(executing));
    return results;
}'
    ) ON CONFLICT (program_id) DO NOTHING;

END $$;

