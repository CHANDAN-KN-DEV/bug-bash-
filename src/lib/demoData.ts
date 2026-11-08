import { Profile, Round, Program, ExamSettings, Assignment, RoundAttempt, Submission, Violation } from '../types';

export const INITIAL_ADMIN: Profile = {
  id: 'a0000000-0000-0000-0000-000000000001',
  role: 'admin',
  full_name: 'Dr. Sarah Vance (Chief Proctor)',
  roll_no: 'ADMIN-001',
  email: 'admin@bugbash.arena',
};

export const INITIAL_STUDENTS: Profile[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    role: 'student',
    full_name: 'Alice Chen',
    roll_no: 'CS2026-001',
    email: 'alice@example.com',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    role: 'student',
    full_name: 'Bob Smith',
    roll_no: 'CS2026-002',
    email: 'bob@example.com',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    role: 'student',
    full_name: 'Charlie Davis',
    roll_no: 'CS2026-003',
    email: 'charlie@example.com',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    role: 'student',
    full_name: 'Diana Prince',
    roll_no: 'CS2026-004',
    email: 'diana@example.com',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    role: 'student',
    full_name: 'Ethan Hunt',
    roll_no: 'CS2026-005',
    email: 'ethan@example.com',
  },
];

export const INITIAL_ROUNDS: Round[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    round_number: 1,
    name: 'Round 1: Rapid Code Debugging',
    description: '10 fundamental defects in core algorithms. Find and correct syntax bugs, off-by-one bounds, and mutation hazards.',
    duration_minutes: 30,
    status: 'live',
    started_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    round_number: 2,
    name: 'Round 2: Algorithm & Data Structure Fixes',
    description: '5 intermediate structural bottlenecks, cycle detection traps, and LRU cache detach anomalies.',
    duration_minutes: 30,
    status: 'ready',
    started_at: null,
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    round_number: 3,
    name: 'Round 3: System Resilience & Concurrency',
    description: '1–2 distributed race conditions, lock renewal flaws, and asynchronous worker deadlocks.',
    duration_minutes: 45,
    status: 'draft',
    started_at: null,
  },
];

export const INITIAL_SETTINGS: ExamSettings = {
  id: 1,
  strict_mode: true,
  max_warnings: 3,
  block_copy_paste: true,
  require_fullscreen: true,
  grace_period_seconds: 2,
};

export const INITIAL_PROGRAMS: Program[] = [
  // Round 1 (10 programs)
  {
    id: 'd1000000-0000-0000-0000-000000000001',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '1. Binary Search Boundary Bug',
    language: 'python',
    points: 10,
    description: 'Find target element index in a sorted list. The current implementation has off-by-one errors causing infinite loops when low and mid meet.',
    buggy_code: `def binary_search(arr, target):
    low = 0
    high = len(arr) # BUG: should be len(arr) - 1

    while low < high: # BUG: misses single element when low == high
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid # BUG: infinite loop when low and mid meet
        else:
            high = mid
            
    return -1`,
    reference_solution: `def binary_search(arr, target):
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
            
    return -1`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000002',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '2. Two-Sum Index Duplication',
    language: 'javascript',
    points: 10,
    description: 'Return indices of the two numbers such that they add up to target. The code mistakenly allows using the same index twice.',
    buggy_code: `function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        map.set(nums[i], i);
    }
    
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        // BUG: map.has(complement) matches element with itself!
        if (map.has(complement)) {
            return [i, map.get(complement)];
        }
    }
    return [];
}`,
    reference_solution: `function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000003',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '3. Valid Palindrome Non-Alphanumeric',
    language: 'python',
    points: 10,
    description: 'Determine if a string is a palindrome after converting uppercase letters into lowercase and removing non-alphanumeric characters.',
    buggy_code: `def is_palindrome(s: str) -> bool:
    # BUG: Fails to ignore spaces, symbols, and case differences
    left = 0
    right = len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True`,
    reference_solution: `def is_palindrome(s: str) -> bool:
    clean = [ch.lower() for ch in s if ch.isalnum()]
    return clean == clean[::-1]`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000004',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '4. Shallow Object Spread Mutation',
    language: 'javascript',
    points: 10,
    description: 'Update nested database configuration without mutating the original application configuration object.',
    buggy_code: `function updateDatabaseHost(config, newHost) {
    // BUG: Shallow spread {...config} still shares nested object reference!
    const copy = { ...config };
    copy.database.host = newHost;
    return copy;
}`,
    reference_solution: `function updateDatabaseHost(config, newHost) {
    return {
        ...config,
        database: {
            ...config.database,
            host: newHost
        }
    };
}`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000005',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '5. Linked List Pointer Null Dereference',
    language: 'cpp',
    points: 10,
    description: 'Delete target node from a singly linked list. Program segfaults when target is not present or list is empty.',
    buggy_code: `struct ListNode {
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
    // BUG: Dereferences curr->next without checking if curr->next is null
    while (curr->next->val != target) {
        curr = curr->next;
    }
    ListNode* toDelete = curr->next;
    curr->next = curr->next->next;
    delete toDelete;
    return head;
}`,
    reference_solution: `ListNode* deleteNode(ListNode* head, int target) {
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
}`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000006',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '6. Fibonacci Mutable Default Memo',
    language: 'python',
    points: 10,
    description: 'Calculate nth Fibonacci with memoization. Uses dangerous mutable default argument and inverted base case.',
    buggy_code: `def fib(n, memo={}):
    # BUG: mutable default argument memo={} persists across calls
    # BUG: base case returns 1 for n=0
    if n == 0:
        return 1
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]`,
    reference_solution: `def fib(n, memo=None):
    if memo is None:
        memo = {}
    if n <= 0:
        return 0
    if n == 1:
        return 1
    if n in memo:
        return memo[n]
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000007',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '7. Merge Sorted Lists Remainder Drop',
    language: 'python',
    points: 10,
    description: 'Merge two sorted arrays. Code terminates early when the first array finishes, dropping all remaining elements.',
    buggy_code: `def merge_sorted(a, b):
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
    # BUG: Completely forgets to append leftover elements from a and b!
    return result`,
    reference_solution: `def merge_sorted(a, b):
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
    return result`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000008',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '8. Anagram Whitespace & Case Bug',
    language: 'javascript',
    points: 10,
    description: 'Check if two strings are valid anagrams. Code fails on punctuation, case differences, and whitespace.',
    buggy_code: `function isAnagram(s1, s2) {
    // BUG: Does not normalize casing or trim whitespaces
    return s1.split("").sort().join("") === s2.split("").sort().join("");
}`,
    reference_solution: `function isAnagram(s1, s2) {
    const clean = str => str.toLowerCase().replace(/[^a-z0-9]/g, "").split("").sort().join("");
    return clean(s1) === clean(s2);
}`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000009',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '9. Integer Parser Sign & Overflow',
    language: 'java',
    points: 10,
    description: 'Parse string into a 32-bit signed integer (atoi). Fails to process minus sign and overflows without clamping.',
    buggy_code: `public class Solution {
    public static int myAtoi(String str) {
        if (str == null || str.trim().isEmpty()) return 0;
        str = str.trim();
        long result = 0;
        // BUG: Does not detect leading '-' or '+' sign
        for (int i = 0; i < str.length(); i++) {
            char ch = str.charAt(i);
            if (!Character.isDigit(ch)) break;
            result = result * 10 + (ch - '0');
            // BUG: No 32-bit integer overflow protection
        }
        return (int) result;
    }
}`,
    reference_solution: `public class Solution {
    public static int myAtoi(String str) {
        if (str == null || str.trim().isEmpty()) return 0;
        str = str.trim();
        int sign = 1;
        int i = 0;
        if (str.charAt(0) == '-') {
            sign = -1;
            i++;
        } else if (str.charAt(0) == '+') {
            i++;
        }
        long result = 0;
        while (i < str.length() && Character.isDigit(str.charAt(i))) {
            result = result * 10 + (str.charAt(i) - '0');
            if (sign == 1 && result > Integer.MAX_VALUE) return Integer.MAX_VALUE;
            if (sign == -1 && -result < Integer.MIN_VALUE) return Integer.MIN_VALUE;
            i++;
        }
        return (int) (sign * result);
    }
}`,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000010',
    round_id: 'c1111111-1111-1111-1111-111111111111',
    title: '10. Sliding Window Moving Average',
    language: 'python',
    points: 10,
    description: 'Calculate moving averages over windows of length k. Has off-by-one loop limit dropping the last window slice.',
    buggy_code: `def sliding_window_avg(nums, k):
    if not nums or k <= 0 or k > len(nums):
        return []
    result = []
    # BUG: len(nums) - k excludes the final valid window!
    for i in range(len(nums) - k):
        window = nums[i : i + k]
        result.append(sum(window) / k)
    return result`,
    reference_solution: `def sliding_window_avg(nums, k):
    if not nums or k <= 0 or k > len(nums):
        return []
    result = []
    window_sum = sum(nums[:k])
    result.append(window_sum / k)
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        result.append(window_sum / k)
    return result`,
  },

  // Round 2 (5 programs)
  {
    id: 'd2000000-0000-0000-0000-000000000001',
    round_id: 'c2222222-2222-2222-2222-222222222222',
    title: '1. Dijkstra Priority Queue Outdated State',
    language: 'python',
    points: 20,
    description: 'Shortest path implementation missing stale distance pruning, causing exponential re-processing of outdated states.',
    buggy_code: `import heapq

def dijkstra(graph, start):
    distances = {node: float("inf") for node in graph}
    distances[start] = 0
    pq = [(0, start)]

    while pq:
        curr_dist, u = heapq.heappop(pq)
        # BUG: Missing if curr_dist > distances[u]: continue
        for v, weight in graph[u].items():
            dist = curr_dist + weight
            if dist < distances[v]:
                distances[v] = dist
                heapq.heappush(pq, (dist, v))
                
    return distances`,
    reference_solution: `import heapq

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
                
    return distances`,
  },
  {
    id: 'd2000000-0000-0000-0000-000000000002',
    round_id: 'c2222222-2222-2222-2222-222222222222',
    title: '2. LRU Cache Inverted Eviction',
    language: 'javascript',
    points: 20,
    description: 'LRU cache mistakenly evicts the most recently accessed item instead of the least recently used key.',
    buggy_code: `class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map();
    }
    get(key) {
        if (!this.map.has(key)) return -1;
        const val = this.map.get(key);
        // BUG: Does not refresh key order in Map
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
}`,
    reference_solution: `class LRUCache {
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
            const oldest = this.map.keys().next().value;
            this.map.delete(oldest);
        }
        this.map.set(key, val);
    }
}`,
  },
  {
    id: 'd2000000-0000-0000-0000-000000000003',
    round_id: 'c2222222-2222-2222-2222-222222222222',
    title: '3. BST Validation Ancestor Range Breach',
    language: 'python',
    points: 20,
    description: 'Validates only immediate parent-child relationships instead of enforcing strict upper and lower bounds on all ancestors.',
    buggy_code: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def is_valid_bst(root):
    if not root:
        return True
    # BUG: Fails if right child contains value smaller than grandparent
    if root.left and root.left.val >= root.val:
        return False
    if root.right and root.right.val <= root.val:
        return False
    return is_valid_bst(root.left) and is_valid_bst(root.right)`,
    reference_solution: `def is_valid_bst(root, min_val=float("-inf"), max_val=float("inf")):
    if not root:
        return True
    if not (min_val < root.val < max_val):
        return False
    return (is_valid_bst(root.left, min_val, root.val) and 
            is_valid_bst(root.right, root.val, max_val))`,
  },
  {
    id: 'd2000000-0000-0000-0000-000000000004',
    round_id: 'c2222222-2222-2222-2222-222222222222',
    title: '4. Matrix Spiral Traversal Bounds Duplicate',
    language: 'cpp',
    points: 20,
    description: 'Spiral traversal fails on rectangular matrices because it traverses bottom and left rows without checking boundary state.',
    buggy_code: `#include <vector>
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
        // BUG: Missing check if (top <= bottom)
        for (int j = right; j >= left; j--) res.push_back(matrix[bottom][j]);
        bottom--;
        // BUG: Missing check if (left <= right)
        for (int i = bottom; i >= top; i--) res.push_back(matrix[i][left]);
        left++;
    }
    return res;
}`,
    reference_solution: `#include <vector>
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
}`,
  },
  {
    id: 'd2000000-0000-0000-0000-000000000005',
    round_id: 'c2222222-2222-2222-2222-222222222222',
    title: '5. Rate Limiter Millisecond Truncation',
    language: 'java',
    points: 20,
    description: 'Token bucket rate limiter performs integer division on millisecond delta, completely dropping sub-second refill rates.',
    buggy_code: `public class RateLimiter {
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
        // BUG: Integer division truncates sub-second token accrual to 0!
        long elapsedMillis = now - lastRefillTimestamp;
        double addedTokens = (elapsedMillis / 1000) * refillRatePerSecond;
        currentTokens = Math.min(capacity, currentTokens + addedTokens);
        lastRefillTimestamp = now;

        if (currentTokens >= tokens) {
            currentTokens -= tokens;
            return true;
        }
        return false;
    }
}`,
    reference_solution: `public class RateLimiter {
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
}`,
  },

  // Round 3 (2 programs)
  {
    id: 'd3000000-0000-0000-0000-000000000001',
    round_id: 'c3333333-3333-3333-3333-333333333333',
    title: '1. Distributed Lock Expiry Race Condition',
    language: 'python',
    points: 50,
    description: 'Redis distributed lock release blindly deletes key. If client was stalled past TTL, it deletes a lock acquired by another client.',
    buggy_code: `import time

class RedisDistributedLock:
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
        # BUG: Blindly deletes the key without verifying self.lock_token!
        # If lock expired, this releases another process' newly acquired lock!
        return self.redis.delete(self.key)`,
    reference_solution: `class RedisDistributedLock:
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
        # Atomic token verification via Lua script
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        return self.redis.eval(lua_script, 1, self.key, self.lock_token)`,
  },
  {
    id: 'd3000000-0000-0000-0000-000000000002',
    round_id: 'c3333333-3333-3333-3333-333333333333',
    title: '2. Promise Concurrency Pool Deadlock',
    language: 'javascript',
    points: 50,
    description: 'Limits task concurrency to N. An unhandled promise rejection fails to remove promise from running set, freezing the queue.',
    buggy_code: `async function promisePool(tasks, limit) {
    const results = [];
    const executing = new Set();
    
    for (const [index, task] of tasks.entries()) {
        const p = Promise.resolve().then(task).then(res => {
            results[index] = res;
            executing.delete(p);
        }); 
        // BUG: If task rejects, executing.delete(p) is skipped!
        // The executing set stays full and Promise.race hangs permanently.
        executing.add(p);
        
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}`,
    reference_solution: `async function promisePool(tasks, limit) {
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
}`,
  },
];

// Initial assignments: assign all 10 programs of Round 1 to all 5 students
export const INITIAL_ASSIGNMENTS: Assignment[] = [];
INITIAL_STUDENTS.forEach(student => {
  INITIAL_PROGRAMS.forEach(prog => {
    INITIAL_ASSIGNMENTS.push({
      id: `assign-${student.id.slice(-4)}-${prog.id.slice(-4)}`,
      student_id: student.id,
      program_id: prog.id,
      round_id: prog.round_id,
    });
  });
});

// Seed sample attempts for live dashboard showcase
const now = Date.now();
export const INITIAL_ATTEMPTS: RoundAttempt[] = [
  {
    id: 'att-alice-r1',
    student_id: INITIAL_STUDENTS[0].id,
    round_id: INITIAL_ROUNDS[0].id,
    started_at: new Date(now - 1000 * 60 * 18).toISOString(),
    ends_at: new Date(now + 1000 * 60 * 12).toISOString(),
    completed_at: null,
    status: 'in_progress',
    warnings_count: 0,
  },
  {
    id: 'att-bob-r1',
    student_id: INITIAL_STUDENTS[1].id,
    round_id: INITIAL_ROUNDS[0].id,
    started_at: new Date(now - 1000 * 60 * 25).toISOString(),
    ends_at: new Date(now - 1000 * 60 * 2).toISOString(),
    completed_at: new Date(now - 1000 * 60 * 2).toISOString(),
    status: 'completed',
    warnings_count: 0,
  },
  {
    id: 'att-charlie-r1',
    student_id: INITIAL_STUDENTS[2].id,
    round_id: INITIAL_ROUNDS[0].id,
    started_at: new Date(now - 1000 * 60 * 10).toISOString(),
    ends_at: new Date(now + 1000 * 60 * 20).toISOString(),
    completed_at: null,
    status: 'terminated',
    termination_reason: 'Terminated due to security policy violation (tab_switch)',
    warnings_count: 1,
  },
  {
    id: 'att-diana-r1',
    student_id: INITIAL_STUDENTS[3].id,
    round_id: INITIAL_ROUNDS[0].id,
    started_at: new Date(now - 1000 * 60 * 14).toISOString(),
    ends_at: new Date(now + 1000 * 60 * 16).toISOString(),
    completed_at: null,
    status: 'in_progress',
    warnings_count: 1,
  },
  {
    id: 'att-ethan-r1',
    student_id: INITIAL_STUDENTS[4].id,
    round_id: INITIAL_ROUNDS[0].id,
    started_at: null,
    ends_at: null,
    completed_at: null,
    status: 'not_started',
    warnings_count: 0,
  },
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  // Alice solved 4 programs
  {
    id: 'sub-alice-1',
    attempt_id: 'att-alice-r1',
    student_id: INITIAL_STUDENTS[0].id,
    program_id: INITIAL_PROGRAMS[0].id,
    code: INITIAL_PROGRAMS[0].reference_solution || '',
    status: 'submitted',
    submitted_at: new Date(now - 1000 * 60 * 14).toISOString(),
    score: 10,
  },
  {
    id: 'sub-alice-2',
    attempt_id: 'att-alice-r1',
    student_id: INITIAL_STUDENTS[0].id,
    program_id: INITIAL_PROGRAMS[1].id,
    code: INITIAL_PROGRAMS[1].reference_solution || '',
    status: 'submitted',
    submitted_at: new Date(now - 1000 * 60 * 10).toISOString(),
    score: 10,
  },
  {
    id: 'sub-alice-3',
    attempt_id: 'att-alice-r1',
    student_id: INITIAL_STUDENTS[0].id,
    program_id: INITIAL_PROGRAMS[2].id,
    code: INITIAL_PROGRAMS[2].reference_solution || '',
    status: 'submitted',
    submitted_at: new Date(now - 1000 * 60 * 5).toISOString(),
    score: 10,
  },
  // Bob completed all 10 programs!
  ...INITIAL_PROGRAMS.slice(0, 10).map((prog, idx) => ({
    id: `sub-bob-${idx + 1}`,
    attempt_id: 'att-bob-r1',
    student_id: INITIAL_STUDENTS[1].id,
    program_id: prog.id,
    code: prog.reference_solution || '',
    status: 'submitted' as const,
    submitted_at: new Date(now - 1000 * 60 * (24 - idx * 2)).toISOString(),
    score: 10,
  })),
];

export const INITIAL_VIOLATIONS: Violation[] = [
  {
    id: 'viol-1',
    student_id: INITIAL_STUDENTS[2].id,
    round_id: INITIAL_ROUNDS[0].id,
    attempt_id: 'att-charlie-r1',
    violation_type: 'tab_switch',
    details: 'User switched away from exam tab to another browser window',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    created_at: new Date(now - 1000 * 60 * 8).toISOString(),
    student_name: 'Charlie Davis',
    student_roll: 'CS2026-003',
    round_name: 'Round 1: Rapid Code Debugging',
  },
  {
    id: 'viol-2',
    student_id: INITIAL_STUDENTS[3].id,
    round_id: INITIAL_ROUNDS[0].id,
    attempt_id: 'att-diana-r1',
    violation_type: 'fullscreen_exit',
    details: 'User pressed Escape or navigated out of mandatory Fullscreen mode',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    created_at: new Date(now - 1000 * 60 * 6).toISOString(),
    student_name: 'Diana Prince',
    student_roll: 'CS2026-004',
    round_name: 'Round 1: Rapid Code Debugging',
  },
];

