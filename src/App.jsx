import { useState } from 'react';
import { Code, FileText, Download, Trash2, Copy, Check, AlertCircle, CheckCircle } from 'lucide-react';
import './App.css';

// ============================================
// UTILITY: Syntax Validator
// ============================================
const FILE_TYPES = {
  jsx: { name: 'JSX', comment: '//', blockComment: ['/*', '*/'], attributes: ['className', 'onClick', 'onChange', 'style', 'id', 'key', 'ref'] },
  tsx: { name: 'TSX', comment: '//', blockComment: ['/*', '*/'], attributes: ['className', 'onClick', 'onChange', 'style', 'id', 'key', 'ref'] },
  js: { name: 'JavaScript', comment: '//', blockComment: ['/*', '*/'] },
  ts: { name: 'TypeScript', comment: '//', blockComment: ['/*', '*/'] },
  php: { name: 'PHP', comment: '//', blockComment: ['/*', '*/'], phpComment: '#', attributes: ['class', 'id', 'style'] },
  html: { name: 'HTML', blockComment: ['<!--', '-->'], attributes: ['class', 'id', 'style', 'data-'] },
  vue: { name: 'Vue', comment: '//', blockComment: ['/*', '*/'], htmlComment: ['<!--', '-->'], attributes: ['class', ':class', 'v-bind:class'] }
};

const validateSyntax = (code, fileType) => {
  const errors = [];
  const warnings = [];
  const lines = code.split('\n');
  const config = FILE_TYPES[fileType];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Check for wrong comment syntax
    if (fileType === 'jsx' || fileType === 'tsx' || fileType === 'js' || fileType === 'ts') {
      if (trimmed.startsWith('#') && !trimmed.startsWith('#!/')) {
        errors.push({
          line: lineNum,
          message: `Wrong comment syntax: Use '//' or '/* */' instead of '#'`,
          type: 'comment'
        });
      }
      if (trimmed.includes('<!--')) {
        errors.push({
          line: lineNum,
          message: `HTML comment syntax not allowed in ${config.name}`,
          type: 'comment'
        });
      }
    }

    if (fileType === 'php') {
      if (trimmed.includes('<!--') && !trimmed.includes('?>')) {
        warnings.push({
          line: lineNum,
          message: `HTML comment in PHP file - make sure it's in HTML context`,
          type: 'comment'
        });
      }
    }

    if (fileType === 'html') {
      if (trimmed.startsWith('//') || (trimmed.startsWith('/*') && !trimmed.includes('<script'))) {
        errors.push({
          line: lineNum,
          message: `JavaScript comment syntax not allowed in HTML (use <!-- -->)`,
          type: 'comment'
        });
      }
    }

    // Check for wrong attributes in JSX/TSX
    if (fileType === 'jsx' || fileType === 'tsx') {
      if (line.includes('class=') && !line.includes('className=')) {
        const match = line.match(/class=["'][^"']*["']/);
        if (match) {
          errors.push({
            line: lineNum,
            message: `Use 'className' instead of 'class' in ${config.name}`,
            type: 'attribute',
            suggestion: match[0].replace('class=', 'className=')
          });
        }
      }
      
      if (line.includes('for=')) {
        errors.push({
          line: lineNum,
          message: `Use 'htmlFor' instead of 'for' in ${config.name}`,
          type: 'attribute'
        });
      }
    }

    // Check for className in non-JSX files
    if ((fileType === 'html' || fileType === 'php') && line.includes('className=')) {
      errors.push({
        line: lineNum,
        message: `Use 'class' instead of 'className' in ${config.name}`,
        type: 'attribute'
      });
    }

    // Check for unclosed tags
    if (fileType === 'jsx' || fileType === 'tsx' || fileType === 'html' || fileType === 'vue') {
      const openTags = (line.match(/<[a-zA-Z][^>]*[^\/]>/g) || []).length;
      const closeTags = (line.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
      const selfClosing = (line.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
      
      if (openTags > closeTags + selfClosing && !line.includes('>') && line.includes('<')) {
        warnings.push({
          line: lineNum,
          message: `Possible unclosed tag or multi-line element`,
          type: 'structure'
        });
      }
    }

    // Check for inline styles as strings in JSX
    if ((fileType === 'jsx' || fileType === 'tsx') && line.includes('style="')) {
      errors.push({
        line: lineNum,
        message: `Style should be an object in JSX: style={{...}} not style="..."`,
        type: 'attribute'
      });
    }

    // Check for event handlers
    if ((fileType === 'jsx' || fileType === 'tsx')) {
      const wrongEvents = ['onclick=', 'onchange=', 'onsubmit='];
      wrongEvents.forEach(event => {
        if (line.toLowerCase().includes(event)) {
          const correct = event.charAt(2).toUpperCase() + event.slice(3);
          errors.push({
            line: lineNum,
            message: `Use camelCase: '${correct}' instead of '${event}'`,
            type: 'attribute'
          });
        }
      });
    }

    // Check for missing semicolons in JS/TS/JSX/TSX
    if ((fileType === 'js' || fileType === 'ts' || fileType === 'jsx' || fileType === 'tsx') && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      if (trimmed.match(/^(const|let|var|return|import|export|throw)\s+.+[^;{}\[\]]$/) && !trimmed.includes('=>')) {
        warnings.push({
          line: lineNum,
          message: `Consider adding semicolon at end of statement`,
          type: 'style'
        });
      }
    }

    // Check for PHP tags
    if (fileType === 'php' && !code.includes('<?php') && code.trim().length > 0) {
      warnings.push({
        line: 1,
        message: `PHP file should start with <?php tag`,
        type: 'structure'
      });
    }
  });

  return { errors, warnings };
};

// ============================================
// UTILITY: CSS Parser & Optimizer
// ============================================
const parseCSSRules = (cssText) => {
  const rules = [];
  const mediaRules = [];
  
  cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  
  const mediaRegex = /@media\s*([^{]+)\s*\{([\s\S]*?)\}(?=\s*(@media|$))/g;
  let match;
  
  while ((match = mediaRegex.exec(cssText)) !== null) {
    mediaRules.push({
      query: match[1].trim(),
      content: match[2]
    });
  }
  
  cssText = cssText.replace(mediaRegex, '');
  
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  
  while ((match = ruleRegex.exec(cssText)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();
    
    if (selector && declarations) {
      rules.push({ selector, declarations });
    }
  }
  
  return { rules, mediaRules };
};

const optimizeCSS = (cssText, usedClasses = null) => {
  const { rules, mediaRules } = parseCSSRules(cssText);
  const grouped = {};
  
  rules.forEach(({ selector, declarations }) => {
    if (!grouped[selector]) {
      grouped[selector] = {};
    }
    
    declarations.split(';').forEach(decl => {
      const [prop, val] = decl.split(':').map(s => s.trim());
      if (prop && val) {
        grouped[selector][prop] = val;
      }
    });
  });
  
  if (usedClasses) {
    Object.keys(grouped).forEach(selector => {
      const classes = selector.match(/\.[a-zA-Z0-9_-]+/g);
      if (classes) {
        const hasUnused = classes.some(cls => !usedClasses.has(cls.slice(1)));
        if (hasUnused && !selector.includes(':')) {
          delete grouped[selector];
        }
      }
    });
  }
  
  let output = '';
  
  Object.keys(grouped).forEach(selector => {
    output += `${selector}{`;
    Object.keys(grouped[selector]).forEach(prop => {
      output += `${prop}:${grouped[selector][prop]};`;
    });
    output += '}';
  });
  
  mediaRules.forEach(({ query, content }) => {
    const { rules: mediaContentRules } = parseCSSRules(content);
    const mediaGrouped = {};
    
    mediaContentRules.forEach(({ selector, declarations }) => {
      if (!mediaGrouped[selector]) {
        mediaGrouped[selector] = {};
      }
      
      declarations.split(';').forEach(decl => {
        const [prop, val] = decl.split(':').map(s => s.trim());
        if (prop && val) {
          mediaGrouped[selector][prop] = val;
        }
      });
    });
    
    if (usedClasses) {
      Object.keys(mediaGrouped).forEach(selector => {
        const classes = selector.match(/\.[a-zA-Z0-9_-]+/g);
        if (classes) {
          const hasUnused = classes.some(cls => !usedClasses.has(cls.slice(1)));
          if (hasUnused && !selector.includes(':')) {
            delete mediaGrouped[selector];
          }
        }
      });
    }
    
    if (Object.keys(mediaGrouped).length > 0) {
      output += `@media ${query}{`;
      Object.keys(mediaGrouped).forEach(selector => {
        output += `${selector}{`;
        Object.keys(mediaGrouped[selector]).forEach(prop => {
          output += `${prop}:${mediaGrouped[selector][prop]};`;
        });
        output += '}';
      });
      output += '}';
    }
  });
  
  return output;
};

const extractClassNames = (jsxCode) => {
  const classes = new Set();
  
  const stringRegex = /className=["']([^"']+)["']/g;
  let match;
  
  while ((match = stringRegex.exec(jsxCode)) !== null) {
    match[1].split(/\s+/).forEach(cls => cls && classes.add(cls));
  }
  
  const templateRegex = /className=\{['"]([^'"]+)['"]\}/g;
  
  while ((match = templateRegex.exec(jsxCode)) !== null) {
    match[1].split(/\s+/).forEach(cls => cls && classes.add(cls));
  }
  
  const conditionalRegex = /className=\{[^}]*['"]([^'"]+)['"]/g;
  
  while ((match = conditionalRegex.exec(jsxCode)) !== null) {
    match[1].split(/\s+/).forEach(cls => cls && classes.add(cls));
  }
  
  return classes;
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function App() {
  const [mode, setMode] = useState('css-only');
  const [fileType, setFileType] = useState('jsx');
  const [jsxInput, setJsxInput] = useState('');
  const [cssInput, setCssInput] = useState('');
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState(null);
  const [validation, setValidation] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleValidate = () => {
    if (!jsxInput.trim()) return;
    
    const result = validateSyntax(jsxInput, fileType);
    setValidation(result);
  };

  const handleOptimize = () => {
    try {
      let result;
      let usedClasses = null;
      
      if (mode === 'jsx-css' && jsxInput.trim()) {
        usedClasses = extractClassNames(jsxInput);
        result = optimizeCSS(cssInput, usedClasses);
      } else {
        result = optimizeCSS(cssInput);
      }
      
      setOutput(result);
      
      const originalSize = new Blob([cssInput]).size;
      const optimizedSize = new Blob([result]).size;
      const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
      
      setStats({
        original: originalSize,
        optimized: optimizedSize,
        reduction,
        usedClasses: usedClasses ? usedClasses.size : null
      });
    } catch (error) {
      setOutput(`/* Error: ${error.message} */`);
      setStats(null);
    }
  };

  const handleClear = () => {
    setJsxInput('');
    setCssInput('');
    setOutput('');
    setStats(null);
    setValidation(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimized.css';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <Code size={24} color="#60a5fa" />
        <h1>CSS Optimizer & Syntax Validator</h1>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <button
          onClick={() => setMode('css-only')}
          className={`mode-btn ${mode === 'css-only' ? 'active' : ''}`}
        >
          CSS Only
        </button>
        <button
          onClick={() => setMode('jsx-css')}
          className={`mode-btn ${mode === 'jsx-css' ? 'active' : ''}`}
        >
          Code + CSS
        </button>

        {mode === 'jsx-css' && (
          <>
            <div className="toolbar-divider" />
            
            <label style={{ fontSize: '14px', color: '#999' }}>File Type:</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="file-select"
            >
              {Object.entries(FILE_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>

            <button
              onClick={handleValidate}
              disabled={!jsxInput.trim()}
              className="validate-btn"
            >
              <AlertCircle size={16} />
              Validate Syntax
            </button>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className={`main-content ${mode === 'jsx-css' ? 'three-columns' : 'two-columns'}`}>
        {mode === 'jsx-css' && (
          <div className="editor-panel">
            <div className="editor-label">
              <FileText size={18} color="#a78bfa" />
              <label>{FILE_TYPES[fileType].name} Code</label>
            </div>
            <textarea
              value={jsxInput}
              onChange={(e) => {
                setJsxInput(e.target.value);
                setValidation(null);
              }}
              placeholder={`Paste your ${FILE_TYPES[fileType].name} code here...`}
              className="editor-textarea"
            />
          </div>
        )}

        <div className="editor-panel">
          <div className="editor-label">
            <Code size={18} color="#60a5fa" />
            <label>CSS Input</label>
          </div>
          <textarea
            value={cssInput}
            onChange={(e) => setCssInput(e.target.value)}
            placeholder="Paste your CSS code here..."
            className="editor-textarea"
          />
        </div>

        <div className="editor-panel">
          <div className="editor-label">
            <Code size={18} color="#34d399" />
            <label>Optimized CSS</label>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="Optimized CSS will appear here..."
            className="editor-textarea output"
          />
        </div>
      </div>

      {/* Validation Results */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="validation-container">
          <div className="validation-panel">
            <div className="validation-header">
              <AlertCircle size={18} color="#f59e0b" />
              <span>Validation Results</span>
            </div>

            <div className="validation-content">
              {validation.errors.map((error, i) => (
                <div key={`error-${i}`} className="validation-item error">
                  <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div className="validation-item-content">
                    <div className="validation-line error">
                      Line {error.line}: {error.type}
                    </div>
                    <div className="validation-message">
                      {error.message}
                    </div>
                    {error.suggestion && (
                      <div className="validation-suggestion">
                        Suggestion: {error.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {validation.warnings.map((warning, i) => (
                <div key={`warning-${i}`} className="validation-item warning">
                  <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div className="validation-item-content">
                    <div className="validation-line warning">
                      Line {warning.line}: {warning.type}
                    </div>
                    <div className="validation-message">
                      {warning.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="validation-footer">
              <span className="error-count">
                {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
              </span>
              <span className="warning-count">
                {validation.warnings.length} Warning{validation.warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {validation && validation.errors.length === 0 && validation.warnings.length === 0 && (
        <div className="validation-container">
          <div className="success-panel">
            <CheckCircle size={20} color="#34d399" />
            <span>No syntax errors found! Your code looks good.</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="stats-container">
          <div className="stats-panel">
            <div className="stat-item">
              <div className="stat-label">Original Size</div>
              <div className="stat-value original">{stats.original} bytes</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Optimized Size</div>
              <div className="stat-value optimized">{stats.optimized} bytes</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Reduction</div>
              <div className="stat-value reduction">{stats.reduction}%</div>
            </div>
            {stats.usedClasses !== null && (
              <div className="stat-item">
                <div className="stat-label">Used Classes</div>
                <div className="stat-value classes">{stats.usedClasses}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="actions-container">
        <button
          onClick={handleOptimize}
          disabled={!cssInput.trim()}
          className="action-btn primary"
        >
          <Code size={18} />
          Optimize CSS
        </button>

        <button
          onClick={handleCopy}
          disabled={!output}
          className="action-btn success"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <button
          onClick={handleDownload}
          disabled={!output}
          className="action-btn secondary"
        >
          <Download size={18} />
          Download
        </button>

        <button
          onClick={handleClear}
          className="action-btn danger"
        >
          <Trash2 size={18} />
          Clear All
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>
          Optimizes CSS by merging duplicate selectors, removing unused classes, and validates syntax errors
        </p>
      </footer>
    </div>
  );
}