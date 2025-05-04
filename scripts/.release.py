import re

with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
    readme_str = f.read()

match_obj = re.search(r'(?<=### )[\s\S]*?(?=#)', readme_str, re.DOTALL)
if match_obj:
    h3_title = match_obj.group(0)
    with open('result.txt', 'w') as f:
        f.write(h3_title)
else:
    with open('result.txt', 'w') as f:
        f.write("")