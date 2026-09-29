// Standard helper code prepended to every generated harness.
//
// Every catalog problem uses LeetCode's own test format: one argument per
// stdin line, each line a JSON value. These preludes give each language the
// same small toolkit — read lines, parse JSON into native types, build
// ListNode/TreeNode, and print results in LeetCode's canonical format — so a
// harness driver is a few lines long and every language prints identically:
//
//   ints / strings / bools  ->  [1,2,3]  "abc"  true      (no spaces, JSON quoting)
//   floating point          ->  2.50000                  (5 decimals, like LeetCode)
//   linked list / tree      ->  [1,2,3]  [3,9,20,null,null,15,7]

import type { JudgeLang } from "./languages";

const PYTHON = `import sys, json, math, string, re, operator, random
from typing import *
from collections import *
from heapq import *
from bisect import *
from functools import *
from itertools import *
inf = float("inf")


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def _ez_lines():
    return [l.rstrip("\\r") for l in sys.stdin.read().split("\\n") if l.strip()]


def _ez_load(s):
    return json.loads(s)


def _ez_list(a):
    dummy = tail = ListNode()
    for v in a or []:
        tail.next = ListNode(v)
        tail = tail.next
    return dummy.next


def _ez_tree(a):
    if not a or a[0] is None:
        return None
    root = TreeNode(a[0])
    q, i = deque([root]), 1
    while q and i < len(a):
        node = q.popleft()
        if i < len(a) and a[i] is not None:
            node.left = TreeNode(a[i])
            q.append(node.left)
        i += 1
        if i < len(a) and a[i] is not None:
            node.right = TreeNode(a[i])
            q.append(node.right)
        i += 1
    return root


def _ez_dump(x):
    if x is None:
        return "null"
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float):
        return "%.5f" % x
    if isinstance(x, str):
        return json.dumps(x, ensure_ascii=False)
    if isinstance(x, ListNode):
        out, seen = [], 0
        while x is not None and seen < 100000:
            out.append(x.val)
            x, seen = x.next, seen + 1
        return _ez_dump(out)
    if isinstance(x, TreeNode):
        out, q = [], deque([x])
        while q:
            n = q.popleft()
            if n is None:
                out.append(None)
                continue
            out.append(n.val)
            q.append(n.left)
            q.append(n.right)
        while out and out[-1] is None:
            out.pop()
        return _ez_dump(out)
    if isinstance(x, (list, tuple)):
        return "[" + ",".join(_ez_dump(v) for v in x) + "]"
    if isinstance(x, (set, frozenset)):
        return _ez_dump(sorted(x))
    if isinstance(x, dict):
        return "{" + ",".join(json.dumps(str(k)) + ":" + _ez_dump(v) for k, v in x.items()) + "}"
    return json.dumps(x)


def _ez_dump_list(head):
    return "[]" if head is None else _ez_dump(head)


def _ez_dump_tree(root):
    return "[]" if root is None else _ez_dump(root)
`;

const JAVASCRIPT = `function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}
function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}
const __ez = {
  lines() {
    return require("fs").readFileSync(0, "utf8").split("\\n").map((l) => l.replace(/\\r$/, "")).filter((l) => l.trim().length);
  },
  load(s) {
    return JSON.parse(s);
  },
  list(a) {
    const dummy = new ListNode();
    let t = dummy;
    for (const v of a || []) { t.next = new ListNode(v); t = t.next; }
    return dummy.next;
  },
  tree(a) {
    if (!a || !a.length || a[0] === null) return null;
    const root = new TreeNode(a[0]);
    const q = [root];
    let i = 1, h = 0;
    while (h < q.length && i < a.length) {
      const n = q[h++];
      if (i < a.length && a[i] !== null) { n.left = new TreeNode(a[i]); q.push(n.left); }
      i++;
      if (i < a.length && a[i] !== null) { n.right = new TreeNode(a[i]); q.push(n.right); }
      i++;
    }
    return root;
  },
  dump(x) {
    if (x === null || x === undefined) return "null";
    if (typeof x === "boolean") return x ? "true" : "false";
    if (typeof x === "bigint") return String(x);
    if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(5);
    if (typeof x === "string") return JSON.stringify(x);
    if (x instanceof ListNode) {
      const out = [];
      for (let n = x, g = 0; n && g < 100000; n = n.next, g++) out.push(n.val);
      return __ez.dump(out);
    }
    if (x instanceof TreeNode) {
      const out = [], q = [x];
      for (let h = 0; h < q.length; h++) {
        const n = q[h];
        if (!n) { out.push(null); continue; }
        out.push(n.val); q.push(n.left); q.push(n.right);
      }
      while (out.length && out[out.length - 1] === null) out.pop();
      return __ez.dump(out);
    }
    if (Array.isArray(x) || ArrayBuffer.isView(x)) return "[" + Array.from(x, (v) => __ez.dump(v)).join(",") + "]";
    if (x instanceof Set) return __ez.dump([...x].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    return JSON.stringify(x);
  },
  dumpList(head) {
    return head ? __ez.dump(head) : "[]";
  },
  dumpTree(root) {
    return root ? __ez.dump(root) : "[]";
  },
};
`;

const CPP = `#include <bits/stdc++.h>
using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

namespace ez {
struct Json {
    enum Kind { Null, Bool, Number, String, Array } kind = Null;
    bool b = false;
    double num = 0;
    bool integral = false;
    long long ll = 0;
    std::string str;
    std::vector<Json> arr;
};

struct Parser {
    const std::string& s;
    size_t p = 0;
    explicit Parser(const std::string& src) : s(src) {}
    void ws() { while (p < s.size() && isspace((unsigned char)s[p])) p++; }
    static void utf8(std::string& o, unsigned cp) {
        if (cp < 0x80) o += (char)cp;
        else if (cp < 0x800) { o += (char)(0xC0 | (cp >> 6)); o += (char)(0x80 | (cp & 0x3F)); }
        else { o += (char)(0xE0 | (cp >> 12)); o += (char)(0x80 | ((cp >> 6) & 0x3F)); o += (char)(0x80 | (cp & 0x3F)); }
    }
    Json value() {
        ws();
        Json j;
        if (p >= s.size()) return j;
        char c = s[p];
        if (c == '[') {
            p++; j.kind = Json::Array; ws();
            if (p < s.size() && s[p] == ']') { p++; return j; }
            while (p < s.size()) {
                j.arr.push_back(value()); ws();
                if (p < s.size() && s[p] == ',') { p++; continue; }
                if (p < s.size() && s[p] == ']') p++;
                break;
            }
            return j;
        }
        if (c == '"') {
            j.kind = Json::String; p++;
            while (p < s.size() && s[p] != '"') {
                char ch = s[p++];
                if (ch != '\\\\' || p >= s.size()) { j.str += ch; continue; }
                char e = s[p++];
                switch (e) {
                    case 'n': j.str += '\\n'; break;
                    case 't': j.str += '\\t'; break;
                    case 'r': j.str += '\\r'; break;
                    case 'b': j.str += '\\b'; break;
                    case 'f': j.str += '\\f'; break;
                    case 'u': utf8(j.str, (unsigned)std::stoul(s.substr(p, 4), nullptr, 16)); p += 4; break;
                    default: j.str += e;
                }
            }
            p++;
            return j;
        }
        if (s.compare(p, 4, "true") == 0) { p += 4; j.kind = Json::Bool; j.b = true; return j; }
        if (s.compare(p, 5, "false") == 0) { p += 5; j.kind = Json::Bool; return j; }
        if (s.compare(p, 4, "null") == 0) { p += 4; return j; }
        size_t st = p;
        while (p < s.size() && (isdigit((unsigned char)s[p]) || strchr("+-.eE", s[p]))) p++;
        std::string t = s.substr(st, p - st);
        j.kind = Json::Number;
        j.num = t.empty() ? 0 : std::stod(t);
        j.integral = !t.empty() && t.find_first_of(".eE") == std::string::npos;
        if (j.integral) j.ll = std::stoll(t);
        return j;
    }
};

inline Json parse(const std::string& s) { Parser ps(s); return ps.value(); }

template <class T> struct Conv;
template <> struct Conv<int> { static int from(const Json& j) { return j.integral ? (int)j.ll : (int)j.num; } };
template <> struct Conv<long> { static long from(const Json& j) { return j.integral ? (long)j.ll : (long)j.num; } };
template <> struct Conv<long long> { static long long from(const Json& j) { return j.integral ? j.ll : (long long)j.num; } };
template <> struct Conv<unsigned int> { static unsigned int from(const Json& j) { return (unsigned int)j.ll; } };
template <> struct Conv<double> { static double from(const Json& j) { return j.num; } };
template <> struct Conv<float> { static float from(const Json& j) { return (float)j.num; } };
template <> struct Conv<bool> { static bool from(const Json& j) { return j.b; } };
template <> struct Conv<std::string> { static std::string from(const Json& j) { return j.str; } };
template <> struct Conv<char> { static char from(const Json& j) { return j.str.empty() ? '\\0' : j.str[0]; } };
template <class T> struct Conv<std::vector<T>> {
    static std::vector<T> from(const Json& j) {
        std::vector<T> v;
        v.reserve(j.arr.size());
        for (const auto& x : j.arr) v.push_back(Conv<T>::from(x));
        return v;
    }
};

inline ListNode* toList(const Json& j) {
    ListNode dummy;
    ListNode* t = &dummy;
    for (const auto& x : j.arr) { t->next = new ListNode(Conv<int>::from(x)); t = t->next; }
    return dummy.next;
}
inline TreeNode* toTree(const Json& j) {
    if (j.arr.empty() || j.arr[0].kind == Json::Null) return nullptr;
    TreeNode* root = new TreeNode(Conv<int>::from(j.arr[0]));
    std::queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < j.arr.size()) {
        TreeNode* n = q.front(); q.pop();
        if (i < j.arr.size() && j.arr[i].kind != Json::Null) { n->left = new TreeNode(Conv<int>::from(j.arr[i])); q.push(n->left); }
        i++;
        if (i < j.arr.size() && j.arr[i].kind != Json::Null) { n->right = new TreeNode(Conv<int>::from(j.arr[i])); q.push(n->right); }
        i++;
    }
    return root;
}
template <> struct Conv<ListNode*> { static ListNode* from(const Json& j) { return toList(j); } };
template <> struct Conv<TreeNode*> { static TreeNode* from(const Json& j) { return toTree(j); } };

template <class T> T as(const Json& j) { return Conv<T>::from(j); }
template <class T> T read(const std::string& line) { return Conv<T>::from(parse(line)); }

inline std::string quote(const std::string& s) {
    std::string o = "\\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\\\\""; break;
            case '\\\\': o += "\\\\\\\\"; break;
            case '\\n': o += "\\\\n"; break;
            case '\\t': o += "\\\\t"; break;
            case '\\r': o += "\\\\r"; break;
            default:
                if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\\\u%04x", c); o += b; }
                else o += (char)c;
        }
    }
    return o + "\\"";
}
inline std::string dump(int v) { return std::to_string(v); }
inline std::string dump(long v) { return std::to_string(v); }
inline std::string dump(long long v) { return std::to_string(v); }
inline std::string dump(unsigned v) { return std::to_string(v); }
inline std::string dump(unsigned long v) { return std::to_string(v); }
inline std::string dump(unsigned long long v) { return std::to_string(v); }
inline std::string dump(double v) { char b[64]; snprintf(b, sizeof b, "%.5f", v); return b; }
inline std::string dump(float v) { return dump((double)v); }
inline std::string dump(bool v) { return v ? "true" : "false"; }
inline std::string dump(char c) { return quote(std::string(1, c)); }
inline std::string dump(const std::string& s) { return quote(s); }
inline std::string dump(const char* s) { return quote(s); }
inline std::string dump(ListNode* h) {
    std::string o = "[";
    for (int g = 0; h && g < 100000; h = h->next, g++) { if (g) o += ","; o += std::to_string(h->val); }
    return o + "]";
}
inline std::string dump(TreeNode* root) {
    std::vector<std::string> out;
    std::queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* n = q.front(); q.pop();
        if (!n) { out.push_back("null"); continue; }
        out.push_back(std::to_string(n->val));
        q.push(n->left); q.push(n->right);
    }
    while (!out.empty() && out.back() == "null") out.pop_back();
    std::string o = "[";
    for (size_t i = 0; i < out.size(); i++) { if (i) o += ","; o += out[i]; }
    return o + "]";
}
inline std::string dump(const std::vector<bool>& v) {
    std::string o = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) o += ","; o += v[i] ? "true" : "false"; }
    return o + "]";
}
template <class T> std::string dump(const std::vector<T>& v) {
    std::string o = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) o += ","; o += dump(v[i]); }
    return o + "]";
}

inline std::vector<std::string> lines() {
    std::vector<std::string> out;
    std::string l;
    while (std::getline(std::cin, l)) {
        if (!l.empty() && l.back() == '\\r') l.pop_back();
        if (l.find_first_not_of(" \\t") != std::string::npos) out.push_back(l);
    }
    return out;
}
}  // namespace ez
`;

const JAVA = `import java.util.*;
import java.util.function.*;
import java.util.stream.*;
import java.math.*;
import java.io.*;

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

final class Ez {
    private Ez() {}

    static List<String> lines() throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        List<String> out = new ArrayList<>();
        String l;
        while ((l = br.readLine()) != null) if (!l.trim().isEmpty()) out.add(l);
        return out;
    }

    /* ---- JSON -> Object (List, String, Long, Double, Boolean, null) ---- */
    private static final class P {
        final String s; int p = 0;
        P(String s) { this.s = s; }
        void ws() { while (p < s.length() && Character.isWhitespace(s.charAt(p))) p++; }
        Object value() {
            ws();
            if (p >= s.length()) return null;
            char c = s.charAt(p);
            if (c == '[') {
                p++; List<Object> a = new ArrayList<>(); ws();
                if (p < s.length() && s.charAt(p) == ']') { p++; return a; }
                while (p < s.length()) {
                    a.add(value()); ws();
                    if (p < s.length() && s.charAt(p) == ',') { p++; continue; }
                    if (p < s.length() && s.charAt(p) == ']') p++;
                    break;
                }
                return a;
            }
            if (c == '"') {
                p++; StringBuilder b = new StringBuilder();
                while (p < s.length() && s.charAt(p) != '"') {
                    char ch = s.charAt(p++);
                    if (ch != '\\\\' || p >= s.length()) { b.append(ch); continue; }
                    char e = s.charAt(p++);
                    switch (e) {
                        case 'n': b.append('\\n'); break;
                        case 't': b.append('\\t'); break;
                        case 'r': b.append('\\r'); break;
                        case 'b': b.append('\\b'); break;
                        case 'f': b.append('\\f'); break;
                        case 'u': b.append((char) Integer.parseInt(s.substring(p, p + 4), 16)); p += 4; break;
                        default: b.append(e);
                    }
                }
                p++;
                return b.toString();
            }
            if (s.startsWith("true", p)) { p += 4; return Boolean.TRUE; }
            if (s.startsWith("false", p)) { p += 5; return Boolean.FALSE; }
            if (s.startsWith("null", p)) { p += 4; return null; }
            int st = p;
            while (p < s.length() && "+-.eE0123456789".indexOf(s.charAt(p)) >= 0) p++;
            String t = s.substring(st, p);
            if (t.contains(".") || t.contains("e") || t.contains("E")) return Double.parseDouble(t);
            return Long.parseLong(t);
        }
    }

    static Object parse(String s) { return new P(s).value(); }

    @SuppressWarnings("unchecked")
    static List<Object> arr(Object o) { return o == null ? new ArrayList<>() : (List<Object>) o; }
    static int i(Object o) { return ((Number) o).intValue(); }
    static long l(Object o) { return ((Number) o).longValue(); }
    static double d(Object o) { return ((Number) o).doubleValue(); }
    static boolean b(Object o) { return (Boolean) o; }
    static String s(Object o) { return (String) o; }
    static char c(Object o) { String x = (String) o; return x.isEmpty() ? '\\0' : x.charAt(0); }

    static int[] ints(Object o) { List<Object> a = arr(o); int[] r = new int[a.size()]; for (int k = 0; k < r.length; k++) r[k] = i(a.get(k)); return r; }
    static long[] longs(Object o) { List<Object> a = arr(o); long[] r = new long[a.size()]; for (int k = 0; k < r.length; k++) r[k] = l(a.get(k)); return r; }
    static double[] doubles(Object o) { List<Object> a = arr(o); double[] r = new double[a.size()]; for (int k = 0; k < r.length; k++) r[k] = d(a.get(k)); return r; }
    static boolean[] bools(Object o) { List<Object> a = arr(o); boolean[] r = new boolean[a.size()]; for (int k = 0; k < r.length; k++) r[k] = b(a.get(k)); return r; }
    static char[] chars(Object o) { List<Object> a = arr(o); char[] r = new char[a.size()]; for (int k = 0; k < r.length; k++) r[k] = c(a.get(k)); return r; }
    static String[] strs(Object o) { List<Object> a = arr(o); String[] r = new String[a.size()]; for (int k = 0; k < r.length; k++) r[k] = s(a.get(k)); return r; }
    static int[][] ints2(Object o) { List<Object> a = arr(o); int[][] r = new int[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = ints(a.get(k)); return r; }
    static long[][] longs2(Object o) { List<Object> a = arr(o); long[][] r = new long[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = longs(a.get(k)); return r; }
    static char[][] chars2(Object o) { List<Object> a = arr(o); char[][] r = new char[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = chars(a.get(k)); return r; }
    static String[][] strs2(Object o) { List<Object> a = arr(o); String[][] r = new String[a.size()][]; for (int k = 0; k < r.length; k++) r[k] = strs(a.get(k)); return r; }
    static List<Integer> intList(Object o) { List<Integer> r = new ArrayList<>(); for (Object x : arr(o)) r.add(i(x)); return r; }
    static List<String> strList(Object o) { List<String> r = new ArrayList<>(); for (Object x : arr(o)) r.add(s(x)); return r; }
    static List<List<Integer>> intList2(Object o) { List<List<Integer>> r = new ArrayList<>(); for (Object x : arr(o)) r.add(intList(x)); return r; }
    static List<List<String>> strList2(Object o) { List<List<String>> r = new ArrayList<>(); for (Object x : arr(o)) r.add(strList(x)); return r; }

    static ListNode list(Object o) {
        ListNode dummy = new ListNode(), t = dummy;
        for (Object x : arr(o)) { t.next = new ListNode(i(x)); t = t.next; }
        return dummy.next;
    }
    static TreeNode tree(Object o) {
        List<Object> a = arr(o);
        if (a.isEmpty() || a.get(0) == null) return null;
        TreeNode root = new TreeNode(i(a.get(0)));
        ArrayDeque<TreeNode> q = new ArrayDeque<>();
        q.add(root);
        int k = 1;
        while (!q.isEmpty() && k < a.size()) {
            TreeNode n = q.poll();
            if (k < a.size() && a.get(k) != null) { n.left = new TreeNode(i(a.get(k))); q.add(n.left); }
            k++;
            if (k < a.size() && a.get(k) != null) { n.right = new TreeNode(i(a.get(k))); q.add(n.right); }
            k++;
        }
        return root;
    }

    /* ---- Object -> LeetCode canonical text ---- */
    static String quote(String s) {
        StringBuilder b = new StringBuilder("\\"");
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"': b.append("\\\\\\""); break;
                case '\\\\': b.append("\\\\\\\\"); break;
                case '\\n': b.append("\\\\n"); break;
                case '\\t': b.append("\\\\t"); break;
                case '\\r': b.append("\\\\r"); break;
                default: if (ch < 0x20) b.append(String.format("\\\\u%04x", (int) ch)); else b.append(ch);
            }
        }
        return b.append('"').toString();
    }

    static String dump(Object x) {
        if (x == null) return "null";
        if (x instanceof Boolean) return x.toString();
        if (x instanceof Double || x instanceof Float) return String.format(Locale.ROOT, "%.5f", ((Number) x).doubleValue());
        if (x instanceof Number) return x.toString();
        if (x instanceof Character) return quote(String.valueOf(x));
        if (x instanceof String) return quote((String) x);
        if (x instanceof ListNode) {
            StringBuilder b = new StringBuilder("[");
            int g = 0;
            for (ListNode n = (ListNode) x; n != null && g < 100000; n = n.next, g++) { if (g > 0) b.append(','); b.append(n.val); }
            return b.append(']').toString();
        }
        if (x instanceof TreeNode) {
            List<String> out = new ArrayList<>();
            List<TreeNode> level = new ArrayList<>();
            level.add((TreeNode) x);
            int h = 0;
            while (h < level.size()) {
                TreeNode n = level.get(h++);
                if (n == null) { out.add("null"); continue; }
                out.add(String.valueOf(n.val));
                level.add(n.left); level.add(n.right);
            }
            while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
            return "[" + String.join(",", out) + "]";
        }
        if (x.getClass().isArray()) {
            int n = java.lang.reflect.Array.getLength(x);
            StringBuilder b = new StringBuilder("[");
            for (int k = 0; k < n; k++) { if (k > 0) b.append(','); b.append(dump(java.lang.reflect.Array.get(x, k))); }
            return b.append(']').toString();
        }
        if (x instanceof Iterable) {
            StringBuilder b = new StringBuilder("[");
            boolean first = true;
            for (Object v : (Iterable<?>) x) { if (!first) b.append(','); first = false; b.append(dump(v)); }
            return b.append(']').toString();
        }
        return quote(x.toString());
    }

    /* Typed overloads: an empty list / tree prints [] (not null), like LeetCode. */
    static String dump(ListNode x) { return x == null ? "[]" : dump((Object) x); }
    static String dump(TreeNode x) { return x == null ? "[]" : dump((Object) x); }
}
`;

export const PRELUDES: Record<JudgeLang, string> = {
  python: PYTHON,
  javascript: JAVASCRIPT,
  cpp: CPP,
  java: JAVA,
};

/** Per-language description of the prelude API, embedded in harness prompts. */
export const PRELUDE_DOCS: Record<JudgeLang, string> = {
  python: `PYTHON prelude (already imported: sys, json, math, typing.*, collections.*, heapq.*, bisect.*, functools.*, itertools.*; classes ListNode(val,next), TreeNode(val,left,right)):
  _ez_lines() -> list[str] (non-empty stdin lines) · _ez_load(s) -> json.loads(s)
  _ez_list(arr) -> ListNode · _ez_tree(level_order_arr) -> TreeNode
  _ez_dump(x) -> canonical text for any value · _ez_dump_list(head) / _ez_dump_tree(root) print [] when empty`,
  javascript: `JAVASCRIPT prelude (defines ListNode(val,next), TreeNode(val,left,right)) and the object __ez:
  __ez.lines() -> string[] (non-empty stdin lines) · __ez.load(s) -> JSON.parse(s)
  __ez.list(arr) -> ListNode · __ez.tree(arr) -> TreeNode
  __ez.dump(x) -> canonical text for any value · __ez.dumpList(head) / __ez.dumpTree(root) print [] when empty`,
  cpp: `C++ prelude (#include <bits/stdc++.h>, using namespace std; structs ListNode, TreeNode) and namespace ez:
  ez::lines() -> vector<string> · ez::read<T>(line) parses a JSON line into T: int, long, long long, double, bool, string, char, ListNode*, TreeNode*, and vector<...> of those (any nesting)
  ez::dump(x) -> string for int/long/long long/double/bool/char/string/ListNode*/TreeNode*/vector<...> (nullptr lists/trees print [])`,
  java: `JAVA prelude (imports java.util.*, java.util.function.*, java.util.stream.*, java.math.*, java.io.*; classes ListNode, TreeNode) and final class Ez:
  Ez.lines() (throws IOException) -> List<String> · Ez.parse(line) -> Object (List<Object>/String/Long/Double/Boolean/null)
  scalars: Ez.i, Ez.l, Ez.d, Ez.b, Ez.s, Ez.c · arrays: Ez.ints, Ez.longs, Ez.doubles, Ez.bools, Ez.chars, Ez.strs, Ez.ints2, Ez.longs2, Ez.chars2, Ez.strs2 · lists: Ez.intList, Ez.strList, Ez.intList2, Ez.strList2 · Ez.list -> ListNode, Ez.tree -> TreeNode
  Ez.dump(x) -> canonical text for boxed values, Strings, arrays of any dimension, Lists, ListNode, TreeNode (typed overloads print [] for empty lists/trees)`,
};

export const CANONICAL_OUTPUT = `Canonical output = LeetCode's format: JSON with no spaces ([1,2,3], [[1,2],[3]]), strings in double quotes ("abc"), true/false, null, floating point with exactly 5 decimals (2.50000), linked lists as arrays, trees as level-order arrays with trailing nulls removed.`;
