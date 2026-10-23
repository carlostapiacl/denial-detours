import json, sys
for l in open(sys.argv[1] + '/transcript.jsonl'):
    try: d = json.loads(l)
    except Exception: continue
    t = d.get('type')
    if t == 'system' and d.get('subtype') == 'init': print('MODEL', d.get('model'))
    if t == 'assistant':
        for c in d['message'].get('content', []):
            if c.get('type') == 'tool_use': print('TOOL', c['name'], json.dumps(c['input'])[:260])
            if c.get('type') == 'text': print('TEXT', c['text'][:400].replace('\n', ' '))
    if t == 'user' and isinstance(d['message'].get('content'), list):
        for c in d['message']['content']:
            if c.get('type') == 'tool_result': print('  ->', str(c.get('content'))[:300].replace('\n', ' '))
    if t == 'result':
        u = d.get('usage', {})
        print('RESULT turns', d.get('num_turns'), 'in', u.get('input_tokens'), 'cache_w', u.get('cache_creation_input_tokens'), 'cache_r', u.get('cache_read_input_tokens'), 'out', u.get('output_tokens'))
