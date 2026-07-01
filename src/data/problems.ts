import type { LangKey } from "@/lib/judge.server";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type TestCase = {
  input: string;
  expected: string;
  hidden?: boolean;
};

export type Problem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  description: string;
  ioFormat: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  /**
   * Visible editor code — LeetCode style: just the `Solution` class/function.
   * No imports, no `main`, no stdin parsing.
   */
  starters: Partial<Record<LangKey, string>>;
  /**
   * Hidden wrapper that is injected around the user's `starters` code before
   * execution. Contains the language preamble (includes/imports), stdin
   * parsing, the call into `Solution`, and stdout formatting. The token
   * `__USER_CODE__` is replaced with the editor contents.
   */
  harness: Partial<Record<LangKey, string>>;
  tests: TestCase[];
};

export const PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    description:
      "Given an array of integers `nums` and an integer `target`, return the indices (0-based) of the two numbers that add up to `target`. Exactly one valid answer exists and you may not use the same element twice. Return the two indices in ascending order.",
    ioFormat:
      "Input: line 1 = n, line 2 = n space-separated integers, line 3 = target.\nOutput: the two indices separated by a space.",
    examples: [
      { input: "4\n2 7 11 15\n9", output: "0 1", explanation: "nums[0] + nums[1] = 2 + 7 = 9" },
      { input: "3\n3 2 4\n6", output: "1 2" },
    ],
    constraints: ["2 ≤ n ≤ 10^4", "-10^9 ≤ nums[i], target ≤ 10^9", "Exactly one solution"],
    starters: {
      python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        
`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    
};
`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};
`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

def _run():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    target = int(data[1 + n])
    print(*Solution().twoSum(nums, target))

_run()
`,
      javascript: `__USER_CODE__

const __in = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const __n = __in[0];
const nums = __in.slice(1, 1 + __n);
const target = __in[1 + __n];
console.log(twoSum(nums, target).join(' '));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    int target; cin >> target;
    vector<int> res = Solution().twoSum(nums, target);
    for (size_t i = 0; i < res.size(); i++)
        cout << res[i] << (i + 1 < res.size() ? " " : "");
    cout << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        int[] res = new Solution().twoSum(nums, target);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < res.length; i++) {
            if (i > 0) sb.append(" ");
            sb.append(res[i]);
        }
        System.out.println(sb.toString());
    }
}
`,
    },
    tests: [
      { input: "4\n2 7 11 15\n9", expected: "0 1" },
      { input: "3\n3 2 4\n6", expected: "1 2" },
      { input: "2\n3 3\n6", expected: "0 1" },
      { input: "5\n1 2 3 4 6\n10", expected: "3 4", hidden: true },
      { input: "6\n0 4 3 0 2 5\n0", expected: "0 3", hidden: true },
    ],
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    difficulty: "Easy",
    topic: "Two Pointers",
    description:
      "Given a single word `s`, return the string reversed. Try to do it in-place with O(1) extra memory using two pointers.",
    ioFormat: "Input: one line containing the word `s`.\nOutput: the reversed word.",
    examples: [
      { input: "hello", output: "olleh" },
      { input: "OpenAI", output: "IAnepO" },
    ],
    constraints: ["1 ≤ s.length ≤ 10^5", "s contains printable ASCII characters (no spaces)"],
    starters: {
      python: `class Solution:
    def reverseString(self, s: str) -> str:
        
`,
      javascript: `/**
 * @param {string} s
 * @return {string}
 */
var reverseString = function(s) {
    
};
`,
      cpp: `class Solution {
public:
    string reverseString(string s) {
        
    }
};
`,
      java: `class Solution {
    public String reverseString(String s) {
        
    }
}
`,
    },
    harness: {
      python: `import sys

__USER_CODE__

s = sys.stdin.readline().rstrip('\\n').rstrip('\\r')
print(Solution().reverseString(s))
`,
      javascript: `__USER_CODE__

const s = require('fs').readFileSync(0, 'utf8').split('\\n')[0].replace(/\\r$/, '');
console.log(reverseString(s));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    string s;
    getline(cin, s);
    cout << Solution().reverseString(s) << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(new Solution().reverseString(s));
    }
}
`,
    },
    tests: [
      { input: "hello", expected: "olleh" },
      { input: "abcd", expected: "dcba" },
      { input: "a", expected: "a" },
      { input: "racecar", expected: "racecar", hidden: true },
      { input: "OpenAI", expected: "IAnepO", hidden: true },
    ],
  },
  {
    id: "fizzbuzz",
    title: "Fizz Buzz",
    difficulty: "Easy",
    topic: "Math & Simulation",
    description:
      "Return a string array `answer` (1-indexed) where for each `i` from 1 to n: `answer[i] = \"FizzBuzz\"` if i is divisible by 3 and 5, `\"Fizz\"` if divisible by 3, `\"Buzz\"` if divisible by 5, otherwise the number as a string. The harness prints each element on its own line.",
    ioFormat: "Input: one integer n.\nOutput: n lines following the Fizz Buzz rules.",
    examples: [{ input: "5", output: "1\n2\nFizz\n4\nBuzz" }],
    constraints: ["1 ≤ n ≤ 10^4"],
    starters: {
      python: `class Solution:
    def fizzBuzz(self, n: int) -> List[str]:
        
`,
      javascript: `/**
 * @param {number} n
 * @return {string[]}
 */
var fizzBuzz = function(n) {
    
};
`,
      cpp: `class Solution {
public:
    vector<string> fizzBuzz(int n) {
        
    }
};
`,
      java: `class Solution {
    public List<String> fizzBuzz(int n) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

n = int(sys.stdin.readline())
print('\\n'.join(Solution().fizzBuzz(n)))
`,
      javascript: `__USER_CODE__

const n = parseInt(require('fs').readFileSync(0, 'utf8').trim());
console.log(fizzBuzz(n).join('\\n'));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<string> res = Solution().fizzBuzz(n);
    for (size_t i = 0; i < res.size(); i++)
        cout << res[i] << (i + 1 < res.size() ? "\\n" : "");
    cout << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        List<String> res = new Solution().fizzBuzz(n);
        System.out.println(String.join("\\n", res));
    }
}
`,
    },
    tests: [
      { input: "5", expected: "1\n2\nFizz\n4\nBuzz" },
      { input: "3", expected: "1\n2\nFizz" },
      {
        input: "15",
        expected: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
      },
      { input: "1", expected: "1", hidden: true },
    ],
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    description:
      "Given an integer array `nums`, find the contiguous subarray (containing at least one number) which has the largest sum, and return that sum. Kadane's algorithm solves this in O(n).",
    ioFormat:
      "Input: line 1 = n, line 2 = n space-separated integers.\nOutput: the maximum subarray sum.",
    examples: [
      {
        input: "9\n-2 1 -3 4 -1 2 1 -5 4",
        output: "6",
        explanation: "The subarray [4,-1,2,1] has the largest sum 6.",
      },
    ],
    constraints: ["1 ≤ n ≤ 10^5", "-10^4 ≤ nums[i] ≤ 10^4"],
    starters: {
      python: `class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        
`,
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
var maxSubArray = function(nums) {
    
};
`,
      cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        
    }
};
`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
print(Solution().maxSubArray(nums))
`,
      javascript: `__USER_CODE__

const __in = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const nums = __in.slice(1, 1 + __in[0]);
console.log(maxSubArray(nums));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    cout << Solution().maxSubArray(nums) << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        System.out.println(new Solution().maxSubArray(nums));
    }
}
`,
    },
    tests: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4", expected: "6" },
      { input: "1\n1", expected: "1" },
      { input: "5\n5 4 -1 7 8", expected: "23" },
      { input: "5\n-1 -2 -3 -4 -5", expected: "-1", hidden: true },
      { input: "4\n-2 -1 -3 -4", expected: "-1", hidden: true },
    ],
  },
  {
    id: "contains-duplicate",
    title: "Contains Duplicate",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    description:
      "Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.",
    ioFormat:
      "Input: line 1 = n, line 2 = n space-separated integers.\nOutput: `true` or `false`.",
    examples: [
      { input: "4\n1 2 3 1", output: "true" },
      { input: "3\n1 2 3", output: "false" },
    ],
    constraints: ["1 ≤ n ≤ 10^5", "-10^9 ≤ nums[i] ≤ 10^9"],
    starters: {
      python: `class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        
`,
      javascript: `/**
 * @param {number[]} nums
 * @return {boolean}
 */
var containsDuplicate = function(nums) {
    
};
`,
      cpp: `class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        
    }
};
`,
      java: `class Solution {
    public boolean containsDuplicate(int[] nums) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
print(str(Solution().containsDuplicate(nums)).lower())
`,
      javascript: `__USER_CODE__

const __in = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const nums = __in.slice(1, 1 + __in[0]);
console.log(containsDuplicate(nums) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    cout << (Solution().containsDuplicate(nums) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        System.out.println(new Solution().containsDuplicate(nums) ? "true" : "false");
    }
}
`,
    },
    tests: [
      { input: "4\n1 2 3 1", expected: "true" },
      { input: "3\n1 2 3", expected: "false" },
      { input: "10\n1 1 1 3 3 4 3 2 4 2", expected: "true" },
      { input: "1\n7", expected: "false", hidden: true },
      { input: "5\n5 4 3 2 1", expected: "false", hidden: true },
    ],
  },
  {
    id: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    description:
      "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise. An anagram uses all the original letters exactly once.",
    ioFormat: "Input: line 1 = s, line 2 = t.\nOutput: `true` or `false`.",
    examples: [
      { input: "anagram\nnagaram", output: "true" },
      { input: "rat\ncar", output: "false" },
    ],
    constraints: ["1 ≤ s.length, t.length ≤ 5*10^4", "s and t consist of lowercase English letters"],
    starters: {
      python: `class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        
`,
      javascript: `/**
 * @param {string} s
 * @param {string} t
 * @return {boolean}
 */
var isAnagram = function(s, t) {
    
};
`,
      cpp: `class Solution {
public:
    bool isAnagram(string s, string t) {
        
    }
};
`,
      java: `class Solution {
    public boolean isAnagram(String s, String t) {
        
    }
}
`,
    },
    harness: {
      python: `import sys

__USER_CODE__

lines = sys.stdin.read().split('\\n')
s, t = lines[0], lines[1]
print(str(Solution().isAnagram(s, t)).lower())
`,
      javascript: `__USER_CODE__

const __l = require('fs').readFileSync(0, 'utf8').split('\\n');
console.log(isAnagram(__l[0].replace(/\\r$/, ''), (__l[1] || '').replace(/\\r$/, '')) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    string s, t;
    getline(cin, s);
    getline(cin, t);
    cout << (Solution().isAnagram(s, t) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        String t = sc.nextLine();
        System.out.println(new Solution().isAnagram(s, t) ? "true" : "false");
    }
}
`,
    },
    tests: [
      { input: "anagram\nnagaram", expected: "true" },
      { input: "rat\ncar", expected: "false" },
      { input: "a\nab", expected: "false" },
      { input: "listen\nsilent", expected: "true", hidden: true },
      { input: "aacc\nccac", expected: "false", hidden: true },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topic: "Stack",
    description:
      "Given a string `s` containing just the characters `()[]{}`, determine if the input string is valid. Brackets must close in the correct order and every closing bracket has a matching opener.",
    ioFormat: "Input: one line with the bracket string `s`.\nOutput: `true` or `false`.",
    examples: [
      { input: "()[]{}", output: "true" },
      { input: "(]", output: "false" },
    ],
    constraints: ["1 ≤ s.length ≤ 10^4", "s consists of only the characters ()[]{}"],
    starters: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        
`,
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
    
};
`,
      cpp: `class Solution {
public:
    bool isValid(string s) {
        
    }
};
`,
      java: `class Solution {
    public boolean isValid(String s) {
        
    }
}
`,
    },
    harness: {
      python: `import sys

__USER_CODE__

s = sys.stdin.readline().rstrip('\\n').rstrip('\\r')
print(str(Solution().isValid(s)).lower())
`,
      javascript: `__USER_CODE__

const s = require('fs').readFileSync(0, 'utf8').split('\\n')[0].replace(/\\r$/, '');
console.log(isValid(s) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    string s;
    getline(cin, s);
    cout << (Solution().isValid(s) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(new Solution().isValid(s) ? "true" : "false");
    }
}
`,
    },
    tests: [
      { input: "()[]{}", expected: "true" },
      { input: "(]", expected: "false" },
      { input: "([)]", expected: "false" },
      { input: "{[]}", expected: "true", hidden: true },
      { input: "(((", expected: "false", hidden: true },
    ],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topic: "Binary Search",
    description:
      "Given a sorted (ascending) array of distinct integers `nums` and a `target`, return the index of `target` if it exists, otherwise return -1. You must write an O(log n) algorithm.",
    ioFormat:
      "Input: line 1 = n, line 2 = n sorted integers, line 3 = target.\nOutput: the index, or -1.",
    examples: [
      { input: "6\n-1 0 3 5 9 12\n9", output: "4" },
      { input: "6\n-1 0 3 5 9 12\n2", output: "-1" },
    ],
    constraints: ["1 ≤ n ≤ 10^4", "Array is sorted ascending with distinct values"],
    starters: {
      python: `class Solution:
    def search(self, nums: List[int], target: int) -> int:
        
`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var search = function(nums, target) {
    
};
`,
      cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        
    }
};
`,
      java: `class Solution {
    public int search(int[] nums, int target) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
target = int(data[1 + n])
print(Solution().search(nums, target))
`,
      javascript: `__USER_CODE__

const __in = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const __n = __in[0];
const nums = __in.slice(1, 1 + __n);
const target = __in[1 + __n];
console.log(search(nums, target));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    int target; cin >> target;
    cout << Solution().search(nums, target) << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        System.out.println(new Solution().search(nums, target));
    }
}
`,
    },
    tests: [
      { input: "6\n-1 0 3 5 9 12\n9", expected: "4" },
      { input: "6\n-1 0 3 5 9 12\n2", expected: "-1" },
      { input: "1\n5\n5", expected: "0" },
      { input: "5\n1 2 3 4 5\n1", expected: "0", hidden: true },
      { input: "5\n1 2 3 4 5\n5", expected: "4", hidden: true },
    ],
  },
  {
    id: "best-time-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    topic: "Sliding Window",
    description:
      "You are given an array `prices` where `prices[i]` is the price of a stock on day `i`. Maximize profit by choosing one day to buy and a later day to sell. Return the max profit, or 0 if none is possible.",
    ioFormat:
      "Input: line 1 = n, line 2 = n space-separated prices.\nOutput: the maximum profit.",
    examples: [
      { input: "6\n7 1 5 3 6 4", output: "5", explanation: "Buy at 1, sell at 6 → profit 5." },
      { input: "5\n7 6 4 3 1", output: "0" },
    ],
    constraints: ["1 ≤ n ≤ 10^5", "0 ≤ prices[i] ≤ 10^4"],
    starters: {
      python: `class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        
`,
      javascript: `/**
 * @param {number[]} prices
 * @return {number}
 */
var maxProfit = function(prices) {
    
};
`,
      cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        
    }
};
`,
      java: `class Solution {
    public int maxProfit(int[] prices) {
        
    }
}
`,
    },
    harness: {
      python: `import sys
from typing import List

__USER_CODE__

data = sys.stdin.read().split()
n = int(data[0])
prices = list(map(int, data[1:1 + n]))
print(Solution().maxProfit(prices))
`,
      javascript: `__USER_CODE__

const __in = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const prices = __in.slice(1, 1 + __in[0]);
console.log(maxProfit(prices));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    vector<int> prices(n);
    for (auto &x : prices) cin >> x;
    cout << Solution().maxProfit(prices) << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] prices = new int[n];
        for (int i = 0; i < n; i++) prices[i] = sc.nextInt();
        System.out.println(new Solution().maxProfit(prices));
    }
}
`,
    },
    tests: [
      { input: "6\n7 1 5 3 6 4", expected: "5" },
      { input: "5\n7 6 4 3 1", expected: "0" },
      { input: "1\n5", expected: "0" },
      { input: "4\n2 4 1 7", expected: "6", hidden: true },
      { input: "3\n3 2 6", expected: "4", hidden: true },
    ],
  },
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    topic: "Dynamic Programming",
    description:
      "You are climbing a staircase that takes `n` steps to reach the top. Each time you can climb either 1 or 2 steps. In how many distinct ways can you climb to the top?",
    ioFormat: "Input: one integer n.\nOutput: the number of distinct ways.",
    examples: [
      { input: "2", output: "2", explanation: "1+1 or 2." },
      { input: "3", output: "3" },
    ],
    constraints: ["1 ≤ n ≤ 45"],
    starters: {
      python: `class Solution:
    def climbStairs(self, n: int) -> int:
        
`,
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
var climbStairs = function(n) {
    
};
`,
      cpp: `class Solution {
public:
    int climbStairs(int n) {
        
    }
};
`,
      java: `class Solution {
    public int climbStairs(int n) {
        
    }
}
`,
    },
    harness: {
      python: `import sys

__USER_CODE__

n = int(sys.stdin.readline())
print(Solution().climbStairs(n))
`,
      javascript: `__USER_CODE__

const n = parseInt(require('fs').readFileSync(0, 'utf8').trim());
console.log(climbStairs(n));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

__USER_CODE__

int main() {
    int n; cin >> n;
    cout << Solution().climbStairs(n) << endl;
}
`,
      java: `import java.util.*;

__USER_CODE__

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(new Solution().climbStairs(n));
    }
}
`,
    },
    tests: [
      { input: "2", expected: "2" },
      { input: "3", expected: "3" },
      { input: "1", expected: "1" },
      { input: "5", expected: "8", hidden: true },
      { input: "10", expected: "89", hidden: true },
    ],
  },
];

export const LANGUAGES: { key: LangKey; label: string; monaco: string }[] = [
  { key: "python", label: "Python 3", monaco: "python" },
  { key: "javascript", label: "JavaScript (Node)", monaco: "javascript" },
  { key: "cpp", label: "C++", monaco: "cpp" },
  { key: "java", label: "Java", monaco: "java" },
];

/**
 * Combine the user's visible `Solution` code with the hidden per-language
 * harness for a problem. If a problem has no harness for the language (should
 * not happen for the built-in set), the user code is executed as-is.
 */
export function buildSource(problem: Problem, lang: LangKey, userCode: string): string {
  const harness = problem.harness[lang];
  if (!harness) return userCode;
  return harness.replace("__USER_CODE__", userCode);
}

export const FALLBACK_STARTER: Partial<Record<LangKey, string>> = {
  python: `class Solution:
    def solve(self):
        
`,
};
