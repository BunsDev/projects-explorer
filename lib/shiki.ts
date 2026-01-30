import { createHighlighter, type Highlighter } from 'shiki'

let highlighter: Highlighter | null = null

export async function getHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['plastic'],
      langs: [
        'javascript',
        'typescript',
        'tsx',
        'jsx',
        'json',
        'css',
        'scss',
        'html',
        'markdown',
        'yaml',
        'sql',
        'shellscript',
        'vue',
        'svelte',
        'xml',
        'toml',
        'makefile',
        'solidity',
      ],
    })
  }
  return highlighter
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    
    // Data formats
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml',
    
    // Styles
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'css',
    
    // Markup
    html: 'html',
    htm: 'html',
    md: 'markdown',
    mdx: 'markdown',
    
    // Frameworks
    vue: 'vue',
    svelte: 'svelte',
    
    // Shell
    sh: 'shellscript',
    bash: 'shellscript',
    zsh: 'shellscript',
    
    // Database
    sql: 'sql',
    
    // Build
    makefile: 'makefile',
    mk: 'makefile',
    mak: 'makefile',
    
    // Blockchain
    sol: 'solidity',
  }
  return map[ext || ''] || 'text'
}
