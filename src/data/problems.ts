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
