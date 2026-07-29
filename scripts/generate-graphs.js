#!/usr/bin/env node
/**
 * Generador de Grafos — Munay v0.1
 * 
 * Crea múltiples visualizaciones del proyecto:
 * 1. Árbol de directorios (estructura del proyecto)
 * 2. Grafo de dependencias entre módulos
 * 3. Jerarquía de rutas (App Router)
 * 4. Grafo de componentes React
 * 5. Mapa de librerías/UI components
 * 
 * Uso: node scripts/generate-graphs.js
 */

const fs = require('fs');
const path = require('path');
const gv = require('graphviz');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/grafos');
const HTML_OUTPUT = path.join(PROJECT_ROOT, 'docs/grafos/index.html');

// ─── 1. Escanear archivos y extraer imports ─────────────────────────────

function scanSourceFiles() {
  const files = [];
  const imports = {}; // file -> { local: [], external: [] }
  
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        const relPath = path.relative(SRC_DIR, p).replace(/\\/g, '/');
        files.push(relPath);
        imports[relPath] = parseImports(fs.readFileSync(p, 'utf-8'), relPath);
      }
    }
  }
  
  walk(SRC_DIR);
  return { files, imports };
}

function parseImports(content, filePath) {
  const local = [];
  const external = new Set();
  
  // Match import statements
  const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const modulePath = m[1] || m[2];
    
    // Classify imports
    if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
      // Resolve relative path
      let resolved;
      if (modulePath.startsWith('/')) {
        resolved = modulePath.slice(1);
      } else {
        const dir = path.dirname(filePath);
        resolved = path.normalize(path.join(dir, modulePath)).replace(/\\/g, '/');
      }
      // Remove file extension
      resolved = resolved.replace(/\.(tsx?|jsx?)$/, '');
      // Handle index files
      if (resolved.endsWith('/index')) resolved = resolved.replace(/\/index$/, '');
      local.push(resolved);
    } else if (!modulePath.startsWith('@')) {
      // External library
      const libName = modulePath.split('/')[0].startsWith('@') 
        ? modulePath.split('/').slice(0, 2).join('/')
        : modulePath.split('/')[0];
      external.add(libName);
    } else {
      // Alias import (@/...)
      const aliasPath = modulePath.replace(/^@\//, '');
      local.push(aliasPath.replace(/\.(tsx?|jsx?)$/, ''));
    }
  }
  
  return { local, external: [...external] };
}

// ─── 2. Detectar estructura de rutas ────────────────────────────────────

function analyzeRoutes() {
  const routes = [];
  const appDir = path.join(SRC_DIR, 'app');
  
  function walkRoutes(dir, basePath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'components') continue;
      const p = path.join(dir, e.name);
      
      if (e.isDirectory()) {
        // Handle dynamic routes [param]
        const routeName = e.name.replace(/^\[(.+)\]$/, ':$1').replace(/^\((.+)\)$/, '');
        const routePath = basePath ? `${basePath}/${routeName}` : routeName;
        
        // Check if it has a page.tsx
        const hasPage = fs.existsSync(path.join(p, 'page.tsx')) || 
                        fs.existsSync(path.join(p, 'page.ts'));
        
        if (hasPage && routeName) {
          routes.push({ path: routePath, dir: p });
        }
        
        walkRoutes(p, routePath);
      }
    }
  }
  
  walkRoutes(appDir, '');
  return routes;
}

// ─── 3. Detectar componentes UI usados ──────────────────────────────────

function analyzeUIComponents(files, imports) {
  const uiComponents = {};
  const componentUsage = {};
  
  for (const file of files) {
    const deps = imports[file];
    if (!deps) continue;
    
    // Track which UI components are used where
    for (const local of deps.local) {
      if (local.includes('components/ui/')) {
        const compName = local.split('/').pop();
        if (!uiComponents[compName]) uiComponents[compName] = [];
        uiComponents[compName].push(file);
      }
    }
    
    // Track component dependencies
    for (const local of deps.local) {
      if (local.includes('components/')) {
        if (!componentUsage[file]) componentUsage[file] = [];
        componentUsage[file].push(local);
      }
    }
  }
  
  return { uiComponents, componentUsage };
}

// ─── 4. Generar Grafo 1: Árbol de directorios ──────────────────────────

function generateDirTreeGraph(files) {
  const g = gv.graph('Estructura');
  g.set('rankdir', 'TB');
  g.set('splines', 'ortho');
  g.set('nodesep', '0.3');
  g.set('ranksep', '0.5');
  g.setNodeAttribut('shape', 'box');
  g.setNodeAttribut('style', 'filled');
  g.setNodeAttribut('fontname', 'Arial');
  g.setNodeAttribut('fontsize', '10');

  
  // Build tree from file paths
  const tree = {};
  for (const file of files) {
    const parts = file.split('/');
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
  }
  
  function addNodes(parentGraph, subtree, parentName, depth) {
    const keys = Object.keys(subtree);
    keys.sort((a, b) => {
      const aIsDir = typeof subtree[a] === 'object' && Object.keys(subtree[a]).length > 0;
      const bIsDir = typeof subtree[b] === 'object' && Object.keys(subtree[b]).length > 0;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });
    
    for (const key of keys) {
      const isFile = Object.keys(subtree[key]).length === 0;
      const nodeName = `${parentName ? parentName + '/' : ''}${key}`.replace(/[^a-zA-Z0-9_\/-]/g, '_');
      const displayName = isFile ? key : `📁 ${key}`;
      const color = isFile ? '#e8f5e9' : '#e3f2fd';
      const shape = isFile ? 'box' : 'folder';
      
      parentGraph.addNode(nodeName, {
        label: displayName,
        fillcolor: color,
        shape: isFile ? 'box' : 'box',
        style: 'filled,rounded',
        color: isFile ? '#a5d6a7' : '#90caf9'
      });
      
      if (parentName) {
        const parentNodeName = parentName.replace(/[^a-zA-Z0-9_\/-]/g, '_');
        parentGraph.addEdge(parentNodeName, nodeName, {
          color: '#90a4ae',
          penwidth: 1
        });
      }
      
      if (!isFile) {
        addNodes(parentGraph, subtree[key], `${parentName ? parentName + '/' : ''}${key}`, depth + 1);
      }
    }
  }
  
  // Root node
  g.addNode('src', {
    label: '📂 src/',
    fillcolor: '#bbdefb',
    style: 'filled,rounded',
    shape: 'box',
    color: '#42a5f5'
  });
  
  addNodes(g, tree, 'src', 0);
  
  return g;
}

// ─── 5. Generar Grafo 2: Dependencias entre módulos ──────────────────

function generateDependencyGraph(files, imports) {
  const g = gv.digraph('Dependencias');
  g.set('rankdir', 'LR');
  g.set('splines', 'true');
  g.set('nodesep', '0.5');
  g.set('ranksep', '1.0');
  g.setNodeAttribut('shape', 'box');
  g.setNodeAttribut('style', 'filled');
  g.setNodeAttribut('fontname', 'Arial');
  g.setNodeAttribut('fontsize', '9');
  
  // Color by directory
  const colorMap = {
    'app': '#fff3e0', // orange
    'components': '#e8f5e9', // green
    'lib': '#e3f2fd', // blue
    'store': '#f3e5f5', // purple
    'hooks': '#fce4ec', // pink
    'types': '#e0f2f1', // teal
  };
  
  const nodeColors = [
    { key: 'app', fill: '#ffe0b2', border: '#ff9800' },
    { key: 'components', fill: '#c8e6c9', border: '#4caf50' },
    { key: 'lib', fill: '#bbdefb', border: '#2196f3' },
    { key: 'store', fill: '#e1bee7', border: '#9c27b0' },
    { key: 'hooks', fill: '#f8bbd0', border: '#e91e63' },
    { key: 'types', fill: '#b2dfdb', border: '#009688' },
  ];
  
  function getCategory(filePath) {
    return filePath.split('/')[0];
  }
  
  // Build category lookup
  const catLookup = {};
  for (const c of nodeColors) catLookup[c.key] = c;
  
  // Add nodes for files that have imports
  const addedNodes = new Set();
  const importantDirs = ['app', 'components', 'lib', 'store', 'hooks'];
  
  for (const file of files) {
    const cat = getCategory(file);
    if (!importantDirs.includes(cat)) continue;
    
    const colors = catLookup[cat] || { fill: '#f5f5f5', border: '#9e9e9e' };
    const nodeId = file.replace(/[^a-zA-Z0-9_\/-]/g, '_');
    const label = file.split('/').slice(-2).join('/');
    
    g.addNode(nodeId, {
      label: label,
      fillcolor: colors.fill,
      color: colors.border,
      style: 'filled,rounded'
    });
    addedNodes.add(nodeId);
  }
  
  // Add edges for dependencies
  for (const file of files) {
    const cat = getCategory(file);
    if (!importantDirs.includes(cat)) continue;
    
    const deps = imports[file];
    if (!deps) continue;
    
    const sourceId = file.replace(/[^a-zA-Z0-9_\/-]/g, '_');
    
    for (const dep of deps.local) {
      // Find which file matches this dependency
      for (const targetFile of files) {
        const targetBase = targetFile.replace(/\.(tsx?|jsx?)$/, '');
        if (targetBase === dep || targetBase.endsWith('/' + dep)) {
          const targetId = targetFile.replace(/[^a-zA-Z0-9_\/-]/g, '_');
          if (addedNodes.has(targetId) && sourceId !== targetId) {
            g.addEdge(sourceId, targetId);
          }
          break;
        }
      }
    }
  }
  
  // Add cluster legends
  const legend = g.addCluster('legend');
  legend.set('label', 'Leyenda');
  legend.set('style', 'dashed');
  legend.set('color', '#bdbdbd');
  legend.set('fontsize', '11');
  
  for (const c of nodeColors) {
    legend.addNode("legend_" + c.key, {
      label: c.key,
      fillcolor: c.fill,
      color: c.border,
      style: 'filled,rounded',
      shape: 'box',
      fontsize: 9
    });
  }
  
  return g;
}

// ─── 6. Generar Grafo 3: Jerarquía de rutas ────────────────────────────

function generateRouteGraph(routes) {
  const g = gv.digraph('Rutas');
  g.set('rankdir', 'TB');
  g.set('splines', 'ortho');
  g.set('nodesep', '0.3');
  g.set('ranksep', '0.5');
  g.setNodeAttribut('shape', 'box');
  g.setNodeAttribut('style', 'filled');
  g.setNodeAttribut('fontname', 'Arial');
  g.setNodeAttribut('fontsize', '10');
  
  // Root
  g.addNode('/', {
    label: '🏠 / (Landing)',
    fillcolor: '#e3f2fd',
    color: '#1976d2',
    style: 'filled,rounded'
  });
  
  // Group routes by depth
  const routeColors = {
    1: { fill: '#e8f5e9', border: '#388e3c' },
    2: { fill: '#fff3e0', border: '#f57c00' },
    3: { fill: '#fce4ec', border: '#c62828' },
    4: { fill: '#f3e5f5', border: '#7b1fa2' },
  };
  
  // Build tree
  const routeTree = {};
  for (const r of routes) {
    const parts = r.path.split('/').filter(Boolean);
    let node = routeTree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
  }
  
  function addRouteNodes(graph, subtree, parentPath, depth) {
    const keys = Object.keys(subtree);
    keys.sort();
    
    for (const key of keys) {
      const fullPath = parentPath ? `${parentPath}/${key}` : key;
      const nodeId = `route_${fullPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const depth_ = fullPath.split('/').length;
      const colors = routeColors[depth_] || { fill: '#f5f5f5', border: '#616161' };
      
      const isDynamic = key.startsWith(':');
      const label = isDynamic ? `⚡ ${key}` : `📄 /${fullPath}`;
      
      graph.addNode(nodeId, {
        label: label,
        fillcolor: colors.fill,
        color: colors.border,
        style: 'filled,rounded'
      });
      
      if (parentPath) {
        const parentId = `route_${parentPath.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        graph.addEdge(parentId, nodeId);
      } else {
        graph.addEdge('/', nodeId);
      }
      
      addRouteNodes(graph, subtree[key], fullPath, depth + 1);
    }
  }
  
  addRouteNodes(g, routeTree, '', 0);
  
  // Add API routes
  const apiRoutes = routes.filter(r => r.path.startsWith('api/'));
  
  if (apiRoutes.length > 0) {
    const apiCluster = g.addCluster('api');
    apiCluster.set('label', 'API Endpoints');
    apiCluster.set('style', 'dashed');
    apiCluster.set('color', '#7e57c2');
    apiCluster.set('fontsize', '11');
    
    for (const r of apiRoutes) {
      const nodeId = `api_${r.path.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const label = r.path.replace('/api', '') || '/';
      apiCluster.addNode(nodeId, {
        label: `🔌 api${label}`,
        fillcolor: '#ede7f6',
        color: '#7e57c2',
        style: 'filled,rounded'
      });
    }
  }
  
  return g;
}

// ─── 7. Generar Grafo 4: Componentes UI y su uso ──────────────────────

function generateUIComponentsGraph(files, imports) {
  const g = gv.digraph('Componentes');
  g.set('rankdir', 'LR');
  g.set('splines', 'true');
  g.set('nodesep', '0.4');
  g.set('ranksep', '0.8');
  g.setNodeAttribut('shape', 'box');
  g.setNodeAttribut('style', 'filled');
  g.setNodeAttribut('fontname', 'Arial');
  g.setNodeAttribut('fontsize', '9');
  
  // Find UI components
  const uiComponents = {};
  const pageFiles = [];
  
  for (const file of files) {
    if (file.startsWith('components/ui/')) {
      const name = file.split('/').pop().replace(/\.(tsx?)$/, '');
      uiComponents[name] = file;
    } else if (file.includes('/page.')) {
      pageFiles.push(file);
    }
  }
  
  // Add UI component nodes
  for (const [name, filepath] of Object.entries(uiComponents)) {
    const nodeId = `ui_${name}`;
    g.addNode(nodeId, {
      label: `🧩 ${name}`,
      fillcolor: '#fff8e1',
      color: '#f9a825',
      style: 'filled,rounded'
    });
  }
  
  // Add page nodes
  for (const file of pageFiles) {
    const route = file.replace('app/', '').replace('/page.tsx', '').replace('/page.ts', '') || '/';
    const nodeId = `page_${route.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const isDynamic = route.includes('[');
    g.addNode(nodeId, {
      label: `📄 /${route}`,
      fillcolor: isDynamic ? '#fce4ec' : '#e8f5e9',
      color: isDynamic ? '#e91e63' : '#4caf50',
      style: 'filled,rounded'
    });
    
    // Connect pages to UI components they use
    const deps = imports[file];
    if (deps) {
      for (const dep of deps.local) {
        for (const [uiName, uiPath] of Object.entries(uiComponents)) {
          const uiBase = uiPath.replace(/\.(tsx?)$/, '');
          if (dep === uiBase || dep.endsWith('/' + uiName)) {
            const uiNodeId = `ui_${uiName}`;
            g.addEdge(nodeId, uiNodeId, {
              style: 'dashed'
            });
          }
        }
      }
    }
  }
  
  return g;
}

// ─── 8. Generar HTML interactivo con vis.js ────────────────────────────

function generateInteractiveHTML(files, imports, routes) {
  // Build nodes and edges for vis.js
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();
  const edgeSet = new Set();
  
  // Category colors
  const catColors = {
    'app': { background: '#FFE0B2', border: '#FF9800' },
    'components': { background: '#C8E6C9', border: '#4CAF50' },
    'lib': { background: '#BBDEFB', border: '#2196F3' },
    'store': { background: '#E1BEE7', border: '#9C27B0' },
    'hooks': { background: '#F8BBD0', border: '#E91E63' },
    'types': { background: '#B2DFDB', border: '#009688' },
    'middleware': { background: '#FFCCBC', border: '#FF5722' }
  };
  
  // Add important files as nodes
  const importantDirs = ['app', 'components', 'lib', 'store', 'hooks'];
  for (const file of files) {
    const cat = file.split('/')[0];
    if (!importantDirs.includes(cat) && cat !== 'middleware.ts') continue;
    
    const displayName = file.split('/').slice(-2).join('/');
    const colors = catColors[cat] || { background: '#F5F5F5', border: '#9E9E9E' };
    const shape = cat === 'app' ? 'box' : cat === 'components' ? 'ellipse' : 'diamond';
    
    nodes.push({
      id: file,
      label: displayName,
      title: `<b>${file}</b><br/>Categoría: ${cat}`,
      color: { background: colors.background, border: colors.border },
      shape: shape,
      size: cat === 'app' ? 30 : cat === 'lib' ? 25 : 20,
      group: cat,
      font: { size: 11 }
    });
    nodeSet.add(file);
  }
  
  // Add edges for dependencies
  for (const file of files) {
    const cat = file.split('/')[0];
    if (!importantDirs.includes(cat)) continue;
    
    const deps = imports[file];
    if (!deps) continue;
    
    for (const dep of deps.local) {
      for (const targetFile of files) {
        const targetBase = targetFile.replace(/\.(tsx?|jsx?)$/, '');
        if ((targetBase === dep || targetBase.endsWith('/' + dep)) && 
            nodeSet.has(targetFile) && file !== targetFile) {
          const edgeKey = `${file}->${targetFile}`;
          if (!edgeSet.has(edgeKey)) {
            edges.push({
              from: file,
              to: targetFile,
              arrows: 'to',
              color: { color: '#90A4AE', opacity: 0.6 },
              width: 1,
              smooth: { type: 'curvedCW', roundness: 0.1 }
            });
            edgeSet.add(edgeKey);
          }
          break;
        }
      }
    }
  }
  
  // Build route hierarchy data
  const routeData = routes.map(r => ({
    id: r.path,
    label: `/${r.path}`,
    group: 'route'
  }));
  
  const routeEdges = [];
  for (const r of routes) {
    const parts = r.path.split('/');
    if (parts.length > 1) {
      const parent = parts.slice(0, -1).join('/');
      routeEdges.push({ from: parent, to: r.path });
    }
  }
  
  return { nodes, edges, routeData, routeEdges };
}

function renderHTML(data) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grafos del Proyecto — Munay v0.1</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.6/standalone/umd/vis-network.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      color: #1e293b;
      overflow: hidden;
      height: 100vh;
    }
    
    /* Header */
    #header {
      background: linear-gradient(135deg, #1e293b, #334155);
      color: white;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      position: relative;
      z-index: 100;
    }
    #header h1 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }
    #header h1 span {
      color: #60a5fa;
    }
    #header .subtitle {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 400;
    }
    
    /* Tab Navigation */
    #tabs {
      display: flex;
      gap: 4px;
      background: #1e293b;
      padding: 0 28px;
      border-bottom: 1px solid #334155;
      position: relative;
      z-index: 100;
    }
    .tab-btn {
      padding: 10px 18px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      color: #94a3b8;
      background: transparent;
      border: none;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
    .tab-btn.active {
      color: #60a5fa;
      border-bottom-color: #60a5fa;
      background: rgba(96, 165, 250, 0.08);
    }
    
    /* Graph Container */
    #graph-container {
      width: 100%;
      height: calc(100vh - 120px);
      position: relative;
    }
    #mynetwork {
      width: 100%;
      height: 100%;
    }
    
    /* Legend */
    #legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      padding: 14px 18px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      font-size: 11px;
      min-width: 140px;
      z-index: 10;
      border: 1px solid #e2e8f0;
    }
    #legend h3 {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
    }
    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(0,0,0,0.1);
    }
    .legend-label {
      color: #475569;
      font-size: 11px;
    }
    
    /* Stats */
    #stats {
      position: absolute;
      top: 16px;
      left: 16px;
      background: white;
      border-radius: 10px;
      padding: 12px 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      font-size: 12px;
      z-index: 10;
      border: 1px solid #e2e8f0;
      display: flex;
      gap: 20px;
    }
    .stat-item {
      text-align: center;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
    }
    .stat-label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    /* Controls */
    .controls {
      display: flex;
      gap: 6px;
    }
    .control-btn {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.15);
      color: #e2e8f0;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: all 0.15s;
    }
    .control-btn:hover {
      background: rgba(255,255,255,0.18);
    }
    
    /* Info Tooltip */
    #info-panel {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      font-size: 12px;
      z-index: 10;
      border: 1px solid #e2e8f0;
      max-width: 320px;
      display: none;
      line-height: 1.5;
    }
    #info-panel h4 {
      font-size: 13px;
      margin-bottom: 4px;
      color: #1e293b;
    }
    #info-panel .info-path {
      color: #64748b;
      font-family: monospace;
      font-size: 11px;
      margin-bottom: 6px;
    }
    #info-panel .info-deps {
      color: #475569;
    }
    #info-panel .close-info {
      position: absolute;
      top: 8px;
      right: 10px;
      cursor: pointer;
      color: #94a3b8;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="header">
    <div>
      <h1>🔮 <span>Munay</span> v0.1 — Grafos del Proyecto</h1>
      <div class="subtitle">Next.js 16 · Neon · Clerk · Brevo · Kushki</div>
    </div>
    <div class="controls">
      <button class="control-btn" onclick="resetView()">🔄 Reset</button>
      <button class="control-btn" onclick="fitView()">🔍 Fit</button>
    </div>
  </div>
  
  <div id="tabs">
    <button class="tab-btn active" onclick="switchTab('deps', this)">🔗 Dependencias</button>
    <button class="tab-btn" onclick="switchTab('routes', this)">🗺️ Rutas</button>
    <button class="tab-btn" onclick="switchTab('ui', this)">🧩 UI Components</button>
  </div>
  
  <div id="graph-container">
    <div id="stats">
      <div class="stat-item">
        <div class="stat-value">${data.nodes.length}</div>
        <div class="stat-label">Módulos</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${data.edges.length}</div>
        <div class="stat-label">Conexiones</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${data.routeData.length}</div>
        <div class="stat-label">Rutas</div>
      </div>
    </div>
    
    <div id="mynetwork"></div>
    
    <div id="legend">
      <h3>Leyenda</h3>
      <div class="legend-item"><div class="legend-color" style="background:#FFE0B2;border-color:#FF9800"></div><span class="legend-label">Pages / App</span></div>
      <div class="legend-item"><div class="legend-color" style="background:#C8E6C9;border-color:#4CAF50"></div><span class="legend-label">Components</span></div>
      <div class="legend-item"><div class="legend-color" style="background:#BBDEFB;border-color:#2196F3"></div><span class="legend-label">Lib / Lógica</span></div>
      <div class="legend-item"><div class="legend-color" style="background:#E1BEE7;border-color:#9C27B0"></div><span class="legend-label">Store</span></div>
      <div class="legend-item"><div class="legend-color" style="background:#F8BBD0;border-color:#E91E63"></div><span class="legend-label">Hooks</span></div>
    </div>
    
    <div id="info-panel">
      <span class="close-info" onclick="closeInfo()">✕</span>
      <h4 id="info-title">Nodo</h4>
      <div class="info-path" id="info-path">ruta/archivo.tsx</div>
      <div class="info-deps" id="info-deps">Dependencias: ...</div>
    </div>
  </div>
  
  <script>
    const DATA = ${JSON.stringify(data, null, 2)};
    let network = null;
    let currentTab = 'deps';
    
    const categoryColors = {
      'app': { background: '#FFE0B2', border: '#FF9800', shape: 'box' },
      'components': { background: '#C8E6C9', border: '#4CAF50', shape: 'ellipse' },
      'lib': { background: '#BBDEFB', border: '#2196F3', shape: 'diamond' },
      'store': { background: '#E1BEE7', border: '#9C27B0', shape: 'star' },
      'hooks': { background: '#F8BBD0', border: '#E91E63', shape: 'triangle' },
      'types': { background: '#B2DFDB', border: '#009688', shape: 'square' }
    };
    
    function buildDependencyNetwork() {
      const nodes = new vis.DataSet(DATA.nodes.map(n => ({
        ...n,
        shape: categoryColors[n.group]?.shape || 'dot',
        color: {
          background: categoryColors[n.group]?.background || '#F5F5F5',
          border: categoryColors[n.group]?.border || '#9E9E9E'
        }
      })));
      
      const edges = new vis.DataSet(DATA.edges);
      
      const options = {
        physics: {
          stabilization: { iterations: 100 },
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -40,
            centralGravity: 0.005,
            springLength: 180,
            springConstant: 0.02,
            damping: 0.4
          }
        },
        layout: { improvedLayout: true },
        edges: {
          smooth: { type: 'curvedCW', roundness: 0.15 },
          arrows: { to: { enabled: true, scaleFactor: 0.6 } }
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          navigationButtons: true,
          keyboard: true
        },
        nodes: {
          font: { size: 11, face: 'Inter, Arial' },
          borderWidth: 1.5,
          borderWidthSelected: 3,
          shadow: { enabled: true, size: 3 }
        }
      };
      
      return { nodes, edges, options };
    }
    
    function buildRouteNetwork() {
      const routeNodes = DATA.routeData.map(r => ({
        id: r.id,
        label: r.label,
        shape: 'box',
        color: {
          background: r.id.includes(':') ? '#FCE4EC' : '#E8F5E9',
          border: r.id.includes(':') ? '#E91E63' : '#4CAF50'
        },
        font: { size: 12 }
      }));
      
      // Route edges
      const routeEdges = [];
      for (const r of DATA.routeData) {
        const parts = r.id.split('/');
        if (parts.length > 1) {
          const parent = parts.slice(0, -1).join('/');
          routeEdges.push({
            from: parent,
            to: r.id,
            arrows: 'to',
            color: { color: '#90A4AE' },
            width: 1.5
          });
        }
      }
      
      // Add root
      routeNodes.unshift({
        id: '',
        label: '🏠 / (Landing)',
        shape: 'box',
        color: { background: '#FFF3E0', border: '#FF9800' },
        font: { size: 14, face: 'Inter, Arial' }
      });
      
      // Connect root to first-level routes
      for (const r of DATA.routeData) {
        if (!r.id.includes('/')) {
          routeEdges.push({
            from: '',
            to: r.id,
            arrows: 'to',
            color: { color: '#FF9800' },
            width: 2
          });
        }
      }
      
      const nodes = new vis.DataSet(routeNodes);
      const edges = new vis.DataSet(routeEdges);
      
      const options = {
        physics: {
          solver: 'hierarchicalRepulsion',
          hierarchicalRepulsion: { nodeDistance: 120 }
        },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'UD',
            sortMethod: 'directed',
            levelSeparation: 60,
            nodeSpacing: 120
          }
        },
        edges: {
          smooth: true,
          arrows: { to: { enabled: true, scaleFactor: 0.8 } }
        },
        interaction: {
          hover: true,
          navigationButtons: true,
          keyboard: true
        },
        nodes: {
          font: { size: 12, face: 'Inter, Arial' },
          borderWidth: 2,
          shadow: { enabled: true }
        }
      };
      
      return { nodes, edges, options };
    }
    
    function buildUINetwork() {
      // Find pages and UI components
      const uiNodes = [];
      const uiEdges = [];
      
      // UI components
      const uiComponents = {};
      const pages = [];
      
      DATA.nodes.forEach(n => {
        if (n.id.includes('components/ui/')) {
          const name = n.id.split('/').pop();
          uiComponents[n.id] = true;
          uiNodes.push({
            id: n.id,
            label: name,
            shape: 'ellipse',
            color: { background: '#FFF8E1', border: '#F9A825' },
            font: { size: 10 },
            group: 'ui'
          });
        } else if (n.id.includes('/page.')) {
          const route = n.id.replace(/^app\//, '').replace(/\/page\.(tsx|ts)$/, '') || '/';
          pages.push(n.id);
          uiNodes.push({
            id: n.id,
            label: route,
            shape: 'box',
            color: { background: '#E8F5E9', border: '#4CAF50' },
            font: { size: 11 },
            group: 'page'
          });
        }
      });
      
      // Connect pages to UI components they use
      DATA.edges.forEach(e => {
        if (pages.includes(e.from) && DATA.nodes.some(n => n.id === e.to && n.id.includes('components/ui/'))) {
          uiEdges.push({
            from: e.from,
            to: e.to,
            arrows: 'to',
            color: { color: '#F9A825', opacity: 0.5 },
            width: 1,
            style: 'dashed'
          });
        }
      });
      
      const nodes = new vis.DataSet(uiNodes);
      const edges = new vis.DataSet(uiEdges);
      
      const options = {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: -50,
            springLength: 150,
            springConstant: 0.03
          }
        },
        edges: {
          smooth: { type: 'curvedCW' },
          arrows: { to: { enabled: true, scaleFactor: 0.6 } }
        },
        interaction: {
          hover: true,
          navigationButtons: true,
          keyboard: true
        },
        nodes: {
          font: { size: 11, face: 'Inter, Arial' },
          borderWidth: 1.5,
          shadow: { enabled: true }
        }
      };
      
      return { nodes, edges, options };
    }
    
    function switchTab(tab, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = tab;
      
      let data;
      if (tab === 'deps') data = buildDependencyNetwork();
      else if (tab === 'routes') data = buildRouteNetwork();
      else data = buildUINetwork();
      
      network.setData(data);
      network.setOptions(data.options);
      network.fit({ animation: true });
    }
    
    function resetView() {
      network.fit({ animation: true });
    }
    
    function fitView() {
      network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    }
    
    function closeInfo() {
      document.getElementById('info-panel').style.display = 'none';
    }
    
    // Initialize
    const container = document.getElementById('mynetwork');
    const initialData = buildDependencyNetwork();
    
    network = new vis.Network(container, initialData, initialData.options);
    
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = DATA.nodes.find(n => n.id === nodeId);
        if (node) {
          document.getElementById('info-title').textContent = node.label;
          document.getElementById('info-path').textContent = nodeId;
          
          // Find dependencies
          const deps = DATA.edges.filter(e => e.from === nodeId).map(e => {
            const target = DATA.nodes.find(n => n.id === e.to);
            return target ? target.label : e.to;
          }).join(', ');
          document.getElementById('info-deps').textContent = deps ? '→ ' + deps : 'Sin dependencias directas';
          document.getElementById('info-panel').style.display = 'block';
        }
      }
    });
    
    network.on('doubleClick', function() {
      closeInfo();
    });
    
    window.addEventListener('resize', () => {
      network.fit({ animation: false });
    });
  </script>
</body>
</html>`;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

console.log('🔮 Generando grafos del proyecto Munay v0.1...\n');

// Ensure output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Scan project
console.log('📂 Escaneando archivos fuente...');
const { files, imports } = scanSourceFiles();
console.log(`   → ${files.length} archivos encontrados`);

// Analyze routes
console.log('🗺️  Analizando rutas...');
const routes = analyzeRoutes();
console.log(`   → ${routes.length} rutas encontradas`);

// Analyze UI components
console.log('🧩 Analizando componentes...');
const { uiComponents, componentUsage } = analyzeUIComponents(files, imports);
console.log(`   → ${Object.keys(uiComponents).length} componentes UI, ${Object.keys(componentUsage).length} archivos con dependencias`);

// Generate DOT files
console.log('\n📝 Generando archivos DOT...');

// Graph 1: Directory Tree
const treeGraph = generateDirTreeGraph(files);
const treeDot = treeGraph.to_dot();
fs.writeFileSync(path.join(OUTPUT_DIR, '01-estructura.dot'), treeDot, 'utf-8');
console.log('   ✅ 01-estructura.dot');

// Graph 2: Dependencies 
const depGraph = generateDependencyGraph(files, imports);
const depDot = depGraph.to_dot();
fs.writeFileSync(path.join(OUTPUT_DIR, '02-dependencias.dot'), depDot, 'utf-8');
console.log('   ✅ 02-dependencias.dot');

// Graph 3: Routes
const routeGraph = generateRouteGraph(routes);
const routeDot = routeGraph.to_dot();
fs.writeFileSync(path.join(OUTPUT_DIR, '03-rutas.dot'), routeDot, 'utf-8');
console.log('   ✅ 03-rutas.dot');

// Graph 4: UI Components
const uiGraph = generateUIComponentsGraph(files, imports);
const uiDot = uiGraph.to_dot();
fs.writeFileSync(path.join(OUTPUT_DIR, '04-componentes-ui.dot'), uiDot, 'utf-8');
console.log('   ✅ 04-componentes-ui.dot');

// Generate interactive HTML
console.log('\n🌐 Generando visualización interactiva HTML...');
const htmlData = generateInteractiveHTML(files, imports, routes);
const html = renderHTML(htmlData);
fs.writeFileSync(HTML_OUTPUT, html, 'utf-8');
console.log(`   ✅ ${path.relative(PROJECT_ROOT, HTML_OUTPUT)}`);

// Generate summary
const summary = `# Grafos del Proyecto — Munay v0.1

## Estadísticas

| Métrica | Valor |
|---------|-------|
| Archivos fuente | ${files.length} |
| Dependencias entre módulos | ${htmlData.edges.length} |
| Rutas (App Router) | ${routes.length} |
| Componentes UI (shadcn) | ${Object.keys(uiComponents).length} |
| Archivos con dependencias | ${Object.keys(componentUsage).length} |

## Grafos generados

1. **Estructura** — Árbol de directorios completo del proyecto
2. **Dependencias** — Grafo de dependencias entre módulos (quién importa a quién)
3. **Rutas** — Jerarquía de rutas del App Router de Next.js
4. **Componentes UI** — Relación entre páginas y componentes UI (shadcn)
5. **Interactivo** — Visualización HTML interactiva con vis.js

## Cómo ver los grafos

- **Archivos .dot**: Abre con cualquier visor DOT (Graphviz Online, VSCode con extensión Graphviz)
- **HTML interactivo**: Abre \`docs/grafos/index.html\` en un navegador
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), summary, 'utf-8');
console.log('   ✅ README.md');

console.log('\n✨ ¡Grafos generados exitosamente!');
console.log(`   📁 docs/grafos/`);
console.log(`   🌐 Abre docs/grafos/index.html en tu navegador`);
