#!/usr/bin/env python3
"""Fix edge-cases.test.ts to use {variableName} syntax instead of $variableName"""

import re

def fix_file():
    filepath = "tests/unit/features/hooks/edge-cases.test.ts"
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 1. Fix validation test expectations -  $ is now valid
    # Change expect(validation.valid).to Be(false); to toBe(true); when comment mentions "lone $ is valid"
    content = re.sub(
        r'(// With \{variableName\} syntax, a lone \$ is valid[^\n]*\n\s*// or should trigger EMPTY_VARIABLE error if followed by non-letter\n\s*)expect\(validation\.valid\)\.toBe\(false\);',
        r'\1expect(validation.valid).toBe(true); // $ is just a literal character',
        content
    )
    
    # 2. Remove EMPTY_VARIABLE check lines for "unclosed dollar sign" test
    content = re.sub(
        r'\n\s*expect\(validation\.errors\.some\(\(e\) => e\.code === "EMPTY_VARIABLE"\)\)\.toBe\(\s*true\s*\);',
        '',
        content
    )
    
    # 3. Fix the second validation test ("empty variable name after dollar")
    # Change expect(validation.valid).toBe(false); to toBe(true); after  "Value: $ "
    content = re.sub(
        r'(const template = "Value: \$ ";[^\}]*?)expect\(validation\.valid\)\.toBe\(false\);',
        r'\1expect(validation.valid).toBe(true); // $ followed by space is valid literal text',
        content
    )
    
    # 4. Fix template strings - replace $varName with {varName} in const template declarations
    # Match quoted template strings and replace $identifier with {identifier}
    def replace_template_vars(match):
        quote = match.group(1)
        content = match.group(2)
        # Replace $identifier with {identifier}, but don't touch ${...} (JS template literals)
        fixed = re.sub(r'\$([a-zA-Z_][a-zA-Z0-9_]*)\b', r'{\1}', content)
        return f'const template = {quote}{fixed}{quote}'
    
    content = re.sub(
        r'const template = (["``])([^"``]*?)\1',
        replace_template_vars,
        content,
        flags=re.MULTILINE
    )
    
    # 5. Fix the for loop that builds strings dynamically
    # Change: template += `$var${i} `; to template += `{var${i}} `;
    content = re.sub(r'template \+= `\$var\$\{i\} `;', 'template += `{var${i}} `;', content)
    content = re.sub(r'context\[`var\$\{i\}`\] = `value\$\{i\}`;', 'context[`var${i}`] = `value${i}`;', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print("File fixed successfully!")

if __name__ == "__main__":
    fix_file()
