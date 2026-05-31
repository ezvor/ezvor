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
  starters: Partial<Record<LangKey, string>>;
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
      python: `import sys

def two_sum(nums, target):
    # TODO: return the two indices whose values sum to target
    return []

def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    nums = list(map(int, data[1:1 + n]))
    target = int(data[1 + n])
    print(*two_sum(nums, target))

main()
`,
      javascript: `const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');

function twoSum(nums, target) {
  // TODO
  return [];
}

const n = parseInt(lines[0]);
const nums = lines[1].split(/\\s+/).map(Number);
const target = parseInt(lines[2]);
console.log(twoSum(nums, target).join(' '));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // TODO
    return {};
}

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    int target; cin >> target;
    auto res = twoSum(nums, target);
    for (size_t i = 0; i < res.size(); i++)
        cout << res[i] << (i + 1 < res.size() ? " " : "");
    cout << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static int[] twoSum(int[] nums, int target) {
        // TODO
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        int[] res = twoSum(nums, target);
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
      python: `import sys

def reverse_string(s):
    # TODO
    return s

s = sys.stdin.readline().strip()
print(reverse_string(s))
`,
      javascript: `const s = require('fs').readFileSync(0, 'utf8').trim();

function reverseString(s) {
  // TODO
  return s;
}

console.log(reverseString(s));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

string reverseString(string s) {
    // TODO
    return s;
}

int main() {
    string s;
    getline(cin, s);
    cout << reverseString(s) << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static String reverseString(String s) {
        // TODO
        return s;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next();
        System.out.println(reverseString(s));
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
      "Print the numbers from 1 to n, one per line. For multiples of 3 print `Fizz`, for multiples of 5 print `Buzz`, and for multiples of both print `FizzBuzz`.",
    ioFormat: "Input: one integer n.\nOutput: n lines following the Fizz Buzz rules.",
    examples: [{ input: "5", output: "1\n2\nFizz\n4\nBuzz" }],
    constraints: ["1 ≤ n ≤ 10^4"],
    starters: {
      python: `import sys

def fizzbuzz(n):
    # TODO: print each line following the Fizz Buzz rules
    for i in range(1, n + 1):
        print(i)

n = int(sys.stdin.readline())
fizzbuzz(n)
`,
      javascript: `const n = parseInt(require('fs').readFileSync(0, 'utf8').trim());

function fizzbuzz(n) {
  // TODO
  for (let i = 1; i <= n; i++) console.log(i);
}

fizzbuzz(n);
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

void fizzbuzz(int n) {
    // TODO
    for (int i = 1; i <= n; i++) cout << i << "\\n";
}

int main() {
    int n; cin >> n;
    fizzbuzz(n);
}
`,
      java: `import java.util.*;

public class Main {
    static void fizzbuzz(int n) {
        // TODO
        for (int i = 1; i <= n; i++) System.out.println(i);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        fizzbuzz(n);
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
      python: `import sys

def max_subarray(nums):
    # TODO
    return 0

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
print(max_subarray(nums))
`,
      javascript: `const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, 1 + n);

function maxSubarray(nums) {
  // TODO
  return 0;
}

console.log(maxSubarray(nums));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

long long maxSubarray(vector<long long>& nums) {
    // TODO
    return 0;
}

int main() {
    int n; cin >> n;
    vector<long long> nums(n);
    for (auto &x : nums) cin >> x;
    cout << maxSubarray(nums) << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static long maxSubarray(long[] nums) {
        // TODO
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextLong();
        System.out.println(maxSubarray(nums));
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
      python: `import sys

def contains_duplicate(nums):
    # TODO
    return False

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
print(str(contains_duplicate(nums)).lower())
`,
      javascript: `const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, 1 + n);

function containsDuplicate(nums) {
  // TODO
  return false;
}

console.log(containsDuplicate(nums) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

bool containsDuplicate(vector<int>& nums) {
    // TODO
    return false;
}

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    cout << (containsDuplicate(nums) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static boolean containsDuplicate(int[] nums) {
        // TODO
        return false;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        System.out.println(containsDuplicate(nums) ? "true" : "false");
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
      python: `import sys

def is_anagram(s, t):
    # TODO
    return False

lines = sys.stdin.read().split('\\n')
s, t = lines[0], lines[1]
print(str(is_anagram(s, t)).lower())
`,
      javascript: `const lines = require('fs').readFileSync(0, 'utf8').split('\\n');
const s = lines[0], t = lines[1];

function isAnagram(s, t) {
  // TODO
  return false;
}

console.log(isAnagram(s, t) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

bool isAnagram(string s, string t) {
    // TODO
    return false;
}

int main() {
    string s, t;
    getline(cin, s);
    getline(cin, t);
    cout << (isAnagram(s, t) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static boolean isAnagram(String s, String t) {
        // TODO
        return false;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        String t = sc.nextLine();
        System.out.println(isAnagram(s, t) ? "true" : "false");
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
      python: `import sys

def is_valid(s):
    # TODO
    return False

s = sys.stdin.readline().strip()
print(str(is_valid(s)).lower())
`,
      javascript: `const s = require('fs').readFileSync(0, 'utf8').trim();

function isValid(s) {
  // TODO
  return false;
}

console.log(isValid(s) ? 'true' : 'false');
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

bool isValid(string s) {
    // TODO
    return false;
}

int main() {
    string s;
    getline(cin, s);
    cout << (isValid(s) ? "true" : "false") << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static boolean isValid(String s) {
        // TODO
        return false;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(isValid(s) ? "true" : "false");
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
      python: `import sys

def search(nums, target):
    # TODO
    return -1

data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:1 + n]))
target = int(data[1 + n])
print(search(nums, target))
`,
      javascript: `const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const n = data[0];
const nums = data.slice(1, 1 + n);
const target = data[1 + n];

function search(nums, target) {
  // TODO
  return -1;
}

console.log(search(nums, target));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

int search(vector<int>& nums, int target) {
    // TODO
    return -1;
}

int main() {
    int n; cin >> n;
    vector<int> nums(n);
    for (auto &x : nums) cin >> x;
    int target; cin >> target;
    cout << search(nums, target) << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static int search(int[] nums, int target) {
        // TODO
        return -1;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        System.out.println(search(nums, target));
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
      python: `import sys

def max_profit(prices):
    # TODO
    return 0

data = sys.stdin.read().split()
n = int(data[0])
prices = list(map(int, data[1:1 + n]))
print(max_profit(prices))
`,
      javascript: `const data = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
const n = data[0];
const prices = data.slice(1, 1 + n);

function maxProfit(prices) {
  // TODO
  return 0;
}

console.log(maxProfit(prices));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

int maxProfit(vector<int>& prices) {
    // TODO
    return 0;
}

int main() {
    int n; cin >> n;
    vector<int> prices(n);
    for (auto &x : prices) cin >> x;
    cout << maxProfit(prices) << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static int maxProfit(int[] prices) {
        // TODO
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] prices = new int[n];
        for (int i = 0; i < n; i++) prices[i] = sc.nextInt();
        System.out.println(maxProfit(prices));
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
      python: `import sys

def climb_stairs(n):
    # TODO
    return 0

n = int(sys.stdin.readline())
print(climb_stairs(n))
`,
      javascript: `const n = parseInt(require('fs').readFileSync(0, 'utf8').trim());

function climbStairs(n) {
  // TODO
  return 0;
}

console.log(climbStairs(n));
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

long long climbStairs(int n) {
    // TODO
    return 0;
}

int main() {
    int n; cin >> n;
    cout << climbStairs(n) << endl;
}
`,
      java: `import java.util.*;

public class Main {
    static long climbStairs(int n) {
        // TODO
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(climbStairs(n));
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
  { key: "typescript", label: "TypeScript", monaco: "typescript" },
  { key: "cpp", label: "C++", monaco: "cpp" },
  { key: "c", label: "C", monaco: "c" },
  { key: "java", label: "Java", monaco: "java" },
  { key: "go", label: "Go", monaco: "go" },
  { key: "rust", label: "Rust", monaco: "rust" },
];

export const FALLBACK_STARTER: Partial<Record<LangKey, string>> = {
  typescript: `// Read all of stdin, then write your answer to stdout.
const input = require('fs').readFileSync(0, 'utf8').trim();
console.log(input);
`,
  c: `#include <stdio.h>

int main() {
    // Read from stdin, write to stdout
    return 0;
}
`,
  go: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    reader := bufio.NewReader(os.Stdin)
    var s string
    fmt.Fscan(reader, &s)
    fmt.Println(s)
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    print!("{}", input.trim());
}
`,
};
