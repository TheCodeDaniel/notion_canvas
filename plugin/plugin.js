// plugin/plugin.js — NotionCanvas Bridge Plugin (main thread)
// Runs inside Figma Desktop. Has access to figma.* Plugin API.
// Cannot use WebSocket or fetch directly — these are handled by ui.html iframe.

figma.showUI(__html__, { visible: false, width: 0, height: 0 });

figma.ui.onmessage = async function (msg) {
  var id = msg.id;
  var action = msg.action;
  var payload = msg.payload;

  try {
    var result;
    switch (action) {
      case 'create_screen':
        result = await createScreen(payload);
        break;
      case 'list_frames':
        result = await listFrames();
        break;
      case 'get_status':
        result = { status: 'ok', version: '1.0.0' };
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    figma.ui.postMessage({ id: id, success: true, result: result });
  } catch (err) {
    var errMsg = (err && err.message) ? err.message : String(err);
    console.error('[NotionCanvas] Plugin error:', errMsg);
    figma.ui.postMessage({ id: id, success: false, error: errMsg });
  }
};

// ── Create a full screen frame from a DesignIR object ────────────────────────
async function createScreen(payload) {
  var design = payload.design;
  var targetPage = payload.targetPage;

  // Find or create the target page
  var page = figma.currentPage;
  if (targetPage) {
    var found = figma.root.children.find(function (p) { return p.name === targetPage; });
    page = found || figma.root.children[0];
  }
  figma.currentPage = page;

  // Load fonts before creating any text nodes
  // Note: Figma uses "Semi Bold" (with space), not "SemiBold"
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  // Create root screen frame
  var frame = figma.createFrame();
  frame.name = design.screenName;
  frame.resize(design.width || 390, design.height || 844);

  if (design.backgroundColor) {
    frame.fills = [{ type: 'SOLID', color: toRgb(design.backgroundColor) }];
  } else {
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  }

  // Position: offset each new screen to the right of existing ones
  var existing = page.children.filter(function (n) { return n.type === 'FRAME'; });
  frame.x = existing.length * ((design.width || 390) + 40);
  frame.y = 0;

  // Render all top-level components
  for (var i = 0; i < (design.components || []).length; i++) {
    var node = await renderComponent(design.components[i]);
    if (node) frame.appendChild(node);
  }

  // Scroll to the new frame so user sees it
  figma.viewport.scrollAndZoomIntoView([frame]);

  return { nodeId: frame.id, screenName: design.screenName };
}

// ── Render a single component recursively ────────────────────────────────────
async function renderComponent(comp) {
  switch (comp.type) {
    case 'text': {
      var t = figma.createText();
      t.name = comp.name;
      t.x = comp.x;
      t.y = comp.y;
      t.resize(comp.width, 1);
      t.textAutoResize = 'HEIGHT';
      t.characters = comp.content || '';
      t.fontSize = comp.fontSize || 16;

      // Font weight — Figma uses "Semi Bold" (with space)
      var weightMap = { Regular: 'Regular', Medium: 'Medium', SemiBold: 'Semi Bold', Bold: 'Bold' };
      var style = weightMap[comp.fontWeight] || 'Regular';
      t.fontName = { family: 'Inter', style: style };

      // Text alignment
      var alignMap = { LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT' };
      t.textAlignHorizontal = alignMap[comp.textAlignHorizontal] || 'LEFT';

      if (comp.fillColor) {
        t.fills = [{ type: 'SOLID', color: toRgb(comp.fillColor) }];
      } else {
        t.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
      }
      return t;
    }

    case 'rectangle': {
      var r = figma.createRectangle();
      r.name = comp.name;
      r.x = comp.x;
      r.y = comp.y;
      r.resize(comp.width, comp.height);
      if (comp.fillColor) {
        r.fills = [{ type: 'SOLID', color: toRgb(comp.fillColor) }];
      } else {
        r.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      }
      if (comp.cornerRadius) r.cornerRadius = comp.cornerRadius;
      if (comp.strokeColor) {
        r.strokes = [{ type: 'SOLID', color: toRgb(comp.strokeColor) }];
        r.strokeWeight = comp.strokeWidth || 1;
      }
      return r;
    }

    case 'button': {
      var btn = figma.createFrame();
      btn.name = comp.name;
      btn.x = comp.x;
      btn.y = comp.y;
      btn.resize(comp.width, comp.height || 48);
      btn.cornerRadius = 8;

      var isPrimary = comp.variant === 'primary';
      var isDestructive = comp.variant === 'destructive';
      var isGhost = comp.variant === 'ghost';

      if (comp.fillColor) {
        btn.fills = [{ type: 'SOLID', color: toRgb(comp.fillColor) }];
      } else if (isPrimary) {
        btn.fills = [{ type: 'SOLID', color: { r: 0.10, g: 0.34, b: 0.86 } }];
      } else if (isDestructive) {
        btn.fills = [{ type: 'SOLID', color: { r: 0.86, g: 0.10, b: 0.10 } }];
      } else if (isGhost) {
        btn.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0 } }];
        btn.strokes = [{ type: 'SOLID', color: { r: 0.80, g: 0.80, b: 0.80 } }];
        btn.strokeWeight = 1;
      } else {
        btn.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
      }

      // Label text
      var label = figma.createText();
      label.characters = comp.label || '';
      label.fontSize = 16;
      label.fontName = { family: 'Inter', style: 'Medium' };

      var labelColor = (isPrimary || isDestructive) ? { r: 1, g: 1, b: 1 } : { r: 0.1, g: 0.1, b: 0.1 };
      label.fills = [{ type: 'SOLID', color: labelColor }];

      // Center label in button
      label.x = Math.max(0, (comp.width - label.width) / 2);
      label.y = Math.max(0, ((comp.height || 48) - label.height) / 2);
      btn.appendChild(label);

      return btn;
    }

    case 'input_field': {
      var field = figma.createFrame();
      field.name = comp.name;
      field.x = comp.x;
      field.y = comp.y;
      field.resize(comp.width, comp.height || 48);
      field.cornerRadius = 8;
      field.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      field.strokes = [{ type: 'SOLID', color: { r: 0.82, g: 0.82, b: 0.82 } }];
      field.strokeWeight = 1;

      var ph = figma.createText();
      ph.characters = comp.placeholder || '';
      ph.fontSize = 14;
      ph.fontName = { family: 'Inter', style: 'Regular' };
      ph.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
      ph.x = 12;
      ph.y = Math.max(0, ((comp.height || 48) - ph.height) / 2);
      field.appendChild(ph);

      return field;
    }

    case 'frame': {
      var f = figma.createFrame();
      f.name = comp.name;
      f.x = comp.x;
      f.y = comp.y;
      f.resize(comp.width, comp.height);

      if (comp.fillColor) {
        f.fills = [{ type: 'SOLID', color: toRgb(comp.fillColor) }];
      } else {
        f.fills = [];
      }
      if (comp.cornerRadius) f.cornerRadius = comp.cornerRadius;

      // Auto Layout
      if (comp.layoutMode && comp.layoutMode !== 'NONE') {
        f.layoutMode = comp.layoutMode;
        f.paddingLeft = comp.paddingLeft != null ? comp.paddingLeft : 16;
        f.paddingRight = comp.paddingRight != null ? comp.paddingRight : 16;
        f.paddingTop = comp.paddingTop != null ? comp.paddingTop : 16;
        f.paddingBottom = comp.paddingBottom != null ? comp.paddingBottom : 16;
        f.itemSpacing = comp.itemSpacing != null ? comp.itemSpacing : 12;
      }

      // Render children
      for (var ci = 0; ci < (comp.children || []).length; ci++) {
        var childNode = await renderComponent(comp.children[ci]);
        if (childNode) f.appendChild(childNode);
      }

      return f;
    }

    default:
      console.warn('[NotionCanvas] Unknown component type: ' + comp.type);
      return null;
  }
}

// ── List all frames on the current page ──────────────────────────────────────
async function listFrames() {
  return figma.currentPage.children
    .filter(function (n) { return n.type === 'FRAME'; })
    .map(function (n) { return { id: n.id, name: n.name }; });
}

// ── Convert RGBA (0-1) color object to Figma RGB ─────────────────────────────
function toRgb(color) {
  return { r: color.r || 0, g: color.g || 0, b: color.b || 0 };
}
