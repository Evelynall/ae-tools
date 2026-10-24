#target "aftereffects"

/**
 * ============================================================
 *  快速矩形 —— 停靠面板版  (v4：填充/描边类型 + 类型替换)
 * ============================================================
 *
 *  安装：运行 jsx/installPanel.jsx，重启 AE 后
 *        在菜单「窗口」底部可找到「快速矩形」
 *  也可：直接运行本文件，以浮动面板形式打开（不常驻）
 *
 *  ！本文件必须保存为 UTF-8 with BOM
 *
 *  ---------- v4 新增 ----------
 *  1. 填充 / 描边各支持三种类型：纯色、线性渐变、径向渐变
 *  2. 「应用到选中图层」按钮 —— 把选中矩形的填充/描边类型替换成面板设置
 *
 *  ---------- 重要限制：渐变颜色无法绑定效果控件 ----------
 *  AE 的「渐变颜色」不是普通颜色属性，而是多色标结构，时间轴里显示为
 *  「编辑渐变」按钮。表达式引擎接收不了这种结构，所以：
 *    - 纯色填充/描边：颜色绑定效果控件，可在效果面板实时调
 *    - 渐变填充/描边：颜色不绑定，需在时间轴里点「编辑渐变」手动调整
 *  这是 AE 的限制，不是实现问题。
 *
 *  ---------- 踩过的坑 ----------
 *  1. 表达式引用效果控件必须用索引 effect("名")(1)（中文版参数名是「滑块」）
 *  2. 脚本里访问控件参数用 matchName：fx.property("ADBE Slider Control-0001")
 *  3. 连续 addProperty 后旧引用会失效，必须每次重新遍历查找
 *  4. 形状组「越靠上渲染越靠前」：必须先加描边、后加填充
 *  5. 删除图形属性会让同级属性的引用立即失效。若复用旧引用去删第二个，
 *     删除会静默失败、属性残留，AE 随后报「内部验证故障」。
 *     所以每删一个都要重新获取容器。删除要用循环 + 重新查找，不能复用引用
 *     也不能对已删除的属性重复 remove
 *  6. 面板模式下脚本抛异常不会弹窗（表现为空白面板），所以属性赋值走 trySet
 *  7. ExtendScript 是 ES3：只用 var / 函数声明
 *  8. 面板脚本自包含，不 #include 外部文件
 * ============================================================
 */

(function (thisObj) {

    var LOG = [];

    function trySet(obj, prop, val) {
        try { obj[prop] = val; return true; }
        catch (e) { LOG.push("! 设置 " + prop + " 失败: " + e.toString()); return false; }
    }

    // ============================================================
    //  类型定义
    // ============================================================
    var KIND_LABELS = ["纯色", "线性渐变", "径向渐变"];

    var MN = {
        fillSolid:   "ADBE Vector Graphic - Fill",
        fillGrad:    "ADBE Vector Graphic - G-Fill",
        fillGradAlt: "ADBE Vector Graphic - Gradient Fill",
        strokeSolid:   "ADBE Vector Graphic - Stroke",
        strokeGrad:    "ADBE Vector Graphic - G-Stroke",
        strokeGradAlt: "ADBE Vector Graphic - Gradient Stroke",
        gradType: "ADBE Vector Grad Type"
    };

    // ============================================================
    //  默认参数
    // ============================================================
    var DEFAULTS = {
        width: 600,
        height: 400,
        radius: 24,
        layerName: "矩形",
        centerOnCreate: true,
        enableStroke: true,
        fillKind: 0,        // 0 纯色 / 1 线性渐变 / 2 径向渐变
        strokeKind: 0,
        strokeWidth: 3,
        fillColor: [1, 1, 1, 1],
        fillOpacity: 100,
        strokeColor: [0.96, 0.85, 0.55, 1],   // 浅金
        strokeOpacity: 100
    };

    var PRESETS = [
        { name: "正方形",   w: 400, h: 400, r: 0,  stroke: true,  sw: 3 },
        { name: "16:9",     w: 800, h: 450, r: 8,  stroke: true,  sw: 3 },
        { name: "圆角卡片", w: 600, h: 400, r: 24, stroke: true,  sw: 3 },
        { name: "分隔线",   w: 800, h: 2,   r: 0,  stroke: false, sw: 0 }
    ];

    var FXN = {
        width: "Rect Width",
        height: "Rect Height",
        offset: "Rect Offset",
        radius: "Corner Radius",
        fillColor: "Fill Color",
        fillOpacity: "Fill Opacity",
        strokeColor: "Stroke Color",
        strokeWidth: "Stroke Width",
        strokeOpacity: "Stroke Opacity"
    };

    var MP = {
        slider: "ADBE Slider Control-0001",
        point: "ADBE Point Control-0001",
        color: "ADBE Color Control-0001"
    };

    var bindErrors = [];

    // 读取上次保存的默认值（函数声明会提升，这里调用是安全的）
    loadDefaults();

    // ============================================================
    //  工具
    // ============================================================

    function num(s, dft) {
        var v = parseFloat(s);
        if (isNaN(v)) { return dft; }
        return v;
    }

    function safeMatch(p) { try { return String(p.matchName); } catch (e) { return ""; } }
    function safeName(p) { try { return String(p.name); } catch (e) { return ""; } }

    function getShapeGroup(layer) {
        try {
            var root = layer.property("ADBE Root Vectors Group");
            for (var i = 1; i <= root.numProperties; i++) {
                if (safeMatch(root.property(i)) === "ADBE Vector Group") { return root.property(i); }
            }
        } catch (e) {}
        return null;
    }

    function getVectors(layer) {
        var g = getShapeGroup(layer);
        if (!g) { return null; }
        try { return g.property("ADBE Vectors Group"); } catch (e) { return null; }
    }

    function getRectPath(layer) {
        var v = getVectors(layer);
        if (!v) { return null; }
        try {
            for (var i = 1; i <= v.numProperties; i++) {
                if (safeMatch(v.property(i)) === "ADBE Vector Shape - Rect") { return v.property(i); }
            }
        } catch (e) {}
        return null;
    }

    function findIn(group, matchName) {
        if (!group) { return null; }
        try {
            for (var i = 1; i <= group.numProperties; i++) {
                if (safeMatch(group.property(i)) === matchName) { return group.property(i); }
            }
        } catch (e) {}
        return null;
    }

    // 按 matchName 关键字查找（大小写不敏感）
    function findInKey(group, key) {
        if (!group) { return null; }
        key = String(key).toLowerCase();
        try {
            for (var i = 1; i <= group.numProperties; i++) {
                if (safeMatch(group.property(i)).toLowerCase().indexOf(key) >= 0) {
                    return group.property(i);
                }
            }
        } catch (e) {}
        return null;
    }

    function getFx(layer, name) {
        try {
            var parade = layer.property("ADBE Effect Parade");
            for (var i = 1; i <= parade.numProperties; i++) {
                if (safeName(parade.property(i)) === name) { return parade.property(i); }
            }
        } catch (e) {}
        return null;
    }

    function setExpr(prop, expr, label) {
        if (!prop) { bindErrors.push(label + "：属性不存在"); return false; }
        try {
            if (!prop.canSetExpression) { bindErrors.push(label + "：不支持表达式"); return false; }
            prop.expression = expr;
            var err = "";
            try { err = String(prop.expressionError); } catch (e) {}
            if (err && err.length > 0) {
                bindErrors.push(label + " -> " + err);
                try { prop.expression = ""; } catch (e2) {}
                return false;
            }
            return true;
        } catch (e) {
            bindErrors.push(label + " -> " + e.toString());
            try { prop.expression = ""; } catch (e2) {}
            return false;
        }
    }

    function uniqueName(comp, base) {
        var name = base;
        var n = 1;
        var dup = true;
        while (dup) {
            dup = false;
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === name) { dup = true; break; }
            }
            if (dup) { n++; name = base + " " + n; }
        }
        return name;
    }

    // ============================================================
    //  形状图形属性（填充/描边）
    // ============================================================

    function addGraphic(vectors, primary, fallback) {
        try { return vectors.addProperty(primary); } catch (e) {}
        if (fallback) {
            try { return vectors.addProperty(fallback); } catch (e2) {}
        }
        LOG.push("! 添加图形属性失败: " + primary);
        return null;
    }

    function gradTypeProp(gradProp) {
        if (!gradProp) { return null; }
        var tp = null;
        try { tp = gradProp.property(MN.gradType); } catch (e) {}
        if (!tp) { tp = findInKey(gradProp, "grad type"); }
        if (!tp) { tp = findInKey(gradProp, "type"); }
        return tp;
    }

    function setGradientType(gradProp, t) {
        var tp = gradTypeProp(gradProp);
        if (!tp) { LOG.push("! 未找到渐变类型属性"); return false; }
        try { tp.setValue(t); return true; }
        catch (e) { LOG.push("! 设置渐变类型失败: " + e.toString()); return false; }
    }

    function getGradientType(gradProp) {
        var tp = gradTypeProp(gradProp);
        if (!tp) { return -1; }
        try { return Number(tp.value); } catch (e) { return -1; }
    }

    // 返回 { prop, kindIndex }  kindIndex 0纯色 1线性 2径向
    function findFill(vectors) {
        var g = findIn(vectors, MN.fillGrad) || findInKey(vectors, "g-fill");
        if (g) {
            var t = getGradientType(g);
            return { prop: g, kindIndex: (t === 2 ? 2 : 1) };
        }
        var s = findIn(vectors, MN.fillSolid);
        if (s) { return { prop: s, kindIndex: 0 }; }
        return null;
    }

    function findStrokeGraphic(vectors) {
        var g = findIn(vectors, MN.strokeGrad) || findInKey(vectors, "g-stroke");
        if (g) {
            var t = getGradientType(g);
            return { prop: g, kindIndex: (t === 2 ? 2 : 1) };
        }
        var s = findIn(vectors, MN.strokeSolid);
        if (s) { return { prop: s, kindIndex: 0 }; }
        return null;
    }

    function removeGraphic(p) {
        if (!p) { return false; }
        try { p.remove(); return true; }
        catch (e) { LOG.push("! 删除图形属性失败: " + e.toString()); return false; }
    }

    // 判断当前类型与目标类型是否「同类」：同类就不用删重建
    // 纯色与渐变是两个不同的属性类型，必须删掉重建；
    // 线性与径向都是渐变属性，只改类型值即可，不用动结构
    function sameFamily(curKind, targetKind) {
        if (curKind === targetKind) { return true; }
        if (curKind !== 0 && targetKind !== 0) { return true; }
        return false;
    }

    // 该图形属性是否与目标不符、需要删除
    function isWrongGraphic(p, cfg) {
        var mn = safeMatch(p).toLowerCase();
        var isFill = (mn.indexOf("fill") >= 0);
        var isStroke = (mn.indexOf("stroke") >= 0);
        if (!isFill && !isStroke) { return false; }
        var isGrad = (mn.indexOf("g-fill") >= 0) ||
                     (mn.indexOf("g-stroke") >= 0) ||
                     (mn.indexOf("gradient") >= 0);
        if (isFill) {
            return (isGrad !== (cfg.fillKind !== 0));
        }
        if (!cfg.enableStroke) { return true; }
        return (isGrad !== (cfg.strokeKind !== 0));
    }

    function readColorOf(graphic) {
        if (!graphic) { return null; }
        var cp = findInKey(graphic, "color");
        if (!cp) { return null; }
        try {
            var v = cp.value;
            if (v && v.length >= 3) { return v; }
        } catch (e) {}
        return null;
    }

    function readNumberOf(graphic, key) {
        if (!graphic) { return null; }
        var p = findInKey(graphic, key);
        if (!p) { return null; }
        try { return Number(p.value); } catch (e) { return null; }
    }

    // ============================================================
    //  表达式绑定
    // ============================================================

    function bindGeometry(layer) {
        var rp = getRectPath(layer);
        setExpr(rp ? findIn(rp, "ADBE Vector Rect Size") : null,
                "[effect(\"" + FXN.width + "\")(1), effect(\"" + FXN.height + "\")(1)]", "大小");
        setExpr(rp ? findIn(rp, "ADBE Vector Rect Position") : null,
                "effect(\"" + FXN.offset + "\")(1)", "位置");
        setExpr(rp ? findIn(rp, "ADBE Vector Rect Roundness") : null,
                "effect(\"" + FXN.radius + "\")(1)", "圆度");
    }

    function bindFill(layer, kindIndex) {
        var f = findFill(getVectors(layer));
        if (!f) { bindErrors.push("填充：未找到填充属性"); return; }
        if (kindIndex === 0) {
            setExpr(findInKey(f.prop, "color"), "effect(\"" + FXN.fillColor + "\")(1)", "填充颜色");
        }
        setExpr(findInKey(f.prop, "opacity"), "effect(\"" + FXN.fillOpacity + "\")(1)", "填充不透明度");
    }

    function bindStroke(layer, kindIndex) {
        var s = findStrokeGraphic(getVectors(layer));
        if (!s) { bindErrors.push("描边：未找到描边属性"); return; }
        if (kindIndex === 0) {
            setExpr(findInKey(s.prop, "color"), "effect(\"" + FXN.strokeColor + "\")(1)", "描边颜色");
        }
        setExpr(findInKey(s.prop, "width"), "effect(\"" + FXN.strokeWidth + "\")(1)", "描边宽度");
        setExpr(findInKey(s.prop, "opacity"), "effect(\"" + FXN.strokeOpacity + "\")(1)", "描边不透明度");
    }

    // ============================================================
    //  效果控件
    // ============================================================

    function addEffects(layer, cfg) {
        var parade = layer.property("ADBE Effect Parade");
        var e;

        e = parade.addProperty("ADBE Slider Control");
        e.name = FXN.width;
        e.property(MP.slider).setValue(cfg.width);

        e = parade.addProperty("ADBE Slider Control");
        e.name = FXN.height;
        e.property(MP.slider).setValue(cfg.height);

        e = parade.addProperty("ADBE Point Control");
        e.name = FXN.offset;
        e.property(MP.point).setValue([0, 0]);

        e = parade.addProperty("ADBE Slider Control");
        e.name = FXN.radius;
        e.property(MP.slider).setValue(cfg.radius);

        // 纯色填充才需要颜色控件（渐变颜色无法绑定）
        if (cfg.fillKind === 0) {
            e = parade.addProperty("ADBE Color Control");
            e.name = FXN.fillColor;
            e.property(MP.color).setValue(cfg.fillColor);
        }

        e = parade.addProperty("ADBE Slider Control");
        e.name = FXN.fillOpacity;
        e.property(MP.slider).setValue(cfg.fillOpacity);

        if (cfg.enableStroke) {
            if (cfg.strokeKind === 0) {
                e = parade.addProperty("ADBE Color Control");
                e.name = FXN.strokeColor;
                e.property(MP.color).setValue(cfg.strokeColor);
            }

            e = parade.addProperty("ADBE Slider Control");
            e.name = FXN.strokeWidth;
            e.property(MP.slider).setValue(cfg.strokeWidth);

            e = parade.addProperty("ADBE Slider Control");
            e.name = FXN.strokeOpacity;
            e.property(MP.slider).setValue(cfg.strokeOpacity);
        }
    }

    function ensureEffect(layer, name, matchName, propMN, defVal) {
        var fx = getFx(layer, name);
        if (fx) { return fx; }
        try {
            var parade = layer.property("ADBE Effect Parade");
            fx = parade.addProperty(matchName);
            fx.name = name;
            try { fx.property(propMN).setValue(defVal); } catch (e) {}
            return fx;
        } catch (e2) {
            LOG.push("! 添加控件 " + name + " 失败: " + e2.toString());
            return null;
        }
    }

    // 读取某个颜色控件的当前值
    function effectColorValue(layer, fxName) {
        var fx = getFx(layer, fxName);
        if (!fx) { return null; }
        try {
            var v = fx.property(MP.color).value;
            if (v && v.length >= 3) { return v; }
        } catch (e) {}
        return null;
    }

    // ============================================================
    //  建立图形属性（顺序：先描边、后填充）
    // ============================================================

    // needFill / needStroke 省略时表示「都建」
    function buildGraphics(vectors, cfg, colors, needFill, needStroke) {
        colors = colors || {};
        if (needStroke === undefined) { needStroke = cfg.enableStroke; }
        if (needFill === undefined) { needFill = true; }

        if (needStroke) {
            if (cfg.strokeKind === 0) {
                var ss = addGraphic(vectors, MN.strokeSolid);
                var sc = findInKey(ss, "color");
                if (sc && colors.stroke) { try { sc.setValue(colors.stroke); } catch (e) {} }
            } else {
                var gs = addGraphic(vectors, MN.strokeGrad, MN.strokeGradAlt);
                setGradientType(gs, cfg.strokeKind === 2 ? 2 : 1);
            }
        }

        if (!needFill) { return; }

        if (cfg.fillKind === 0) {
            var fs = addGraphic(vectors, MN.fillSolid);
            var fc = findInKey(fs, "color");
            if (fc && colors.fill) { try { fc.setValue(colors.fill); } catch (e) {} }
        } else {
            var gf = addGraphic(vectors, MN.fillGrad, MN.fillGradAlt);
            setGradientType(gf, cfg.fillKind === 2 ? 2 : 1);
        }
    }

    // ============================================================
    //  创建矩形
    // ============================================================

    function createRect(cfg, comp) {
        bindErrors = [];

        var layer = comp.layers.addShape();
        layer.name = uniqueName(comp, cfg.layerName);

        var root = layer.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "矩形 1";
        var vectors = group.property("ADBE Vectors Group");

        vectors.addProperty("ADBE Vector Shape - Rect");

        buildGraphics(vectors, cfg, { fill: cfg.fillColor, stroke: cfg.strokeColor });

        addEffects(layer, cfg);

        // 从这里起所有引用重新获取
        bindGeometry(layer);
        bindFill(layer, cfg.fillKind);
        if (cfg.enableStroke) { bindStroke(layer, cfg.strokeKind); }

        if (cfg.centerOnCreate) {
            try {
                layer.property("ADBE Transform Group")
                     .property("ADBE Position")
                     .setValue([comp.width / 2, comp.height / 2]);
            } catch (err) {}
        }

        try { layer.selected = true; } catch (err2) {}
        return layer;
    }

    // ============================================================
    //  替换选中图层的填充/描边类型
    // ============================================================

    function applyToSelected(cfg) {
        bindErrors = [];

        var layer = null;
        try {
            var comp = app.project.activeItem;
            if (comp && comp.selectedLayers && comp.selectedLayers.length > 0) {
                layer = comp.selectedLayers[0];
            }
        } catch (e) {}

        if (!layer) { return { ok: false, msg: "请先在合成里选中一个图层" }; }
        if (!getShapeGroup(layer)) { return { ok: false, msg: "「" + layer.name + "」不是形状图层" }; }

        var v0 = getVectors(layer);
        if (!v0) { return { ok: false, msg: "找不到形状内容组" }; }

        // ---- 1. 检测当前类型 + 读取要保留的参数 ----
        var curFill = findFill(v0);
        var curStroke = findStrokeGraphic(v0);

        var oldFillColor = (curFill && curFill.kindIndex === 0) ? readColorOf(curFill.prop) : null;
        var oldStrokeColor = (curStroke && curStroke.kindIndex === 0) ? readColorOf(curStroke.prop) : null;
        var oldFillOpacity = curFill ? readNumberOf(curFill.prop, "opacity") : null;
        var oldStrokeWidth = curStroke ? readNumberOf(curStroke.prop, "width") : null;
        var oldStrokeOpacity = curStroke ? readNumberOf(curStroke.prop, "opacity") : null;

        var sameFill = (curFill && curFill.kindIndex === cfg.fillKind);
        var sameStroke = (cfg.enableStroke && curStroke && curStroke.kindIndex === cfg.strokeKind) ||
                         (!cfg.enableStroke && !curStroke);

        if (sameFill && sameStroke) {
            return { ok: true, msg: "已是目标类型，无需替换：" + (layer.name) };
        }

        // ---- 2. 决定用的颜色（优先沿用原有）----
        var useFillColor = oldFillColor || effectColorValue(layer, FXN.fillColor) || cfg.fillColor;
        var useStrokeColor = oldStrokeColor || effectColorValue(layer, FXN.strokeColor) || cfg.strokeColor;

        // ---- 3. 先添加目标类型，再删除旧类型 ----
        // 顺序是踩坑换来的：「先删后加」时，在刚删过属性的容器里添加渐变属性，
        // AE 会报「内部验证故障」（stream at index ... mismatch with result）。
        // 改成先加后删就绕开了 —— 添加时容器处于完整状态，删除只是收尾。
        var v1 = getVectors(layer);
        if (!v1) { return { ok: false, msg: "找不到形状内容组" }; }

        var needAddFill = !curFill || !sameFamily(curFill.kindIndex, cfg.fillKind);
        var needAddStroke = cfg.enableStroke && (!curStroke || !sameFamily(curStroke.kindIndex, cfg.strokeKind));

        if (needAddFill || needAddStroke) {
            buildGraphics(v1, cfg, { fill: useFillColor, stroke: useStrokeColor },
                          needAddFill, needAddStroke);
        }

        // ---- 4. 删除与目标类型不符的旧图形属性 ----
        // 每删一个都重新获取容器：删除会让同级属性引用立即失效，
        // 复用旧引用会导致删除静默失败、属性残留。
        for (var pass = 0; pass < 8; pass++) {
            var vv = getVectors(layer);
            if (!vv) { break; }
            var victim = null;
            for (var k = 1; k <= vv.numProperties; k++) {
                if (isWrongGraphic(vv.property(k), cfg)) { victim = vv.property(k); break; }
            }
            if (!victim) { break; }
            if (!removeGraphic(victim)) { break; }
        }

        // ---- 5. 沿用不透明度 / 宽度，并统一渐变类型 ----
        var v2 = getVectors(layer);
        var newFill = findFill(v2);
        var newStroke = findStrokeGraphic(v2);

        // 线性 / 径向：同类时只改这个值，不用动结构
        if (newFill && cfg.fillKind !== 0) {
            setGradientType(newFill.prop, cfg.fillKind === 2 ? 2 : 1);
        }
        if (newStroke && cfg.enableStroke && cfg.strokeKind !== 0) {
            setGradientType(newStroke.prop, cfg.strokeKind === 2 ? 2 : 1);
        }

        if (oldFillOpacity !== null && newFill) {
            var nfo = findInKey(newFill.prop, "opacity");
            if (nfo) { try { nfo.setValue(oldFillOpacity); } catch (e) {} }
        }
        if (oldStrokeWidth !== null && newStroke) {
            var nsw = findInKey(newStroke.prop, "width");
            if (nsw) { try { nsw.setValue(oldStrokeWidth); } catch (e) {} }
        }
        if (oldStrokeOpacity !== null && newStroke) {
            var nso = findInKey(newStroke.prop, "opacity");
            if (nso) { try { nso.setValue(oldStrokeOpacity); } catch (e) {} }
        }

        // ---- 6. 确保所需效果控件存在 ----
        if (cfg.fillKind === 0) {
            ensureEffect(layer, FXN.fillColor, "ADBE Color Control", MP.color, useFillColor);
        }
        ensureEffect(layer, FXN.fillOpacity, "ADBE Slider Control", MP.slider, cfg.fillOpacity);
        if (cfg.enableStroke) {
            if (cfg.strokeKind === 0) {
                ensureEffect(layer, FXN.strokeColor, "ADBE Color Control", MP.color, useStrokeColor);
            }
            ensureEffect(layer, FXN.strokeWidth, "ADBE Slider Control", MP.slider, cfg.strokeWidth);
            ensureEffect(layer, FXN.strokeOpacity, "ADBE Slider Control", MP.slider, cfg.strokeOpacity);
        }

        // ---- 7. 重新绑定表达式 ----
        bindFill(layer, cfg.fillKind);
        if (cfg.enableStroke) { bindStroke(layer, cfg.strokeKind); }

        var msg = "已替换「" + layer.name + "」：填充 = " + KIND_LABELS[cfg.fillKind];
        if (cfg.enableStroke) { msg += "，描边 = " + KIND_LABELS[cfg.strokeKind]; }
        else { msg += "，已移除描边"; }
        var hasGradient = (cfg.fillKind !== 0) || (cfg.enableStroke && cfg.strokeKind !== 0);
        if (hasGradient) {
            msg += "｜渐变颜色请在时间轴点「编辑渐变」调整";
        }
        if (bindErrors.length > 0) { msg += "（" + bindErrors.length + " 项绑定失败）"; }

        return { ok: true, msg: msg, layer: layer };
    }

    // ============================================================
    //  拆分：复制出「只有描边」的图层，参数绑定到原图层
    //  用途：给描边单独加发光之类的效果
    // ============================================================
    function splitStroke() {
        bindErrors = [];

        var original = null;
        try {
            var comp0 = app.project.activeItem;
            if (comp0 && comp0.selectedLayers && comp0.selectedLayers.length > 0) {
                original = comp0.selectedLayers[0];
            }
        } catch (e) {}

        if (!original) { return { ok: false, msg: "请先在合成里选中一个形状图层" }; }
        if (!getShapeGroup(original)) { return { ok: false, msg: "「" + original.name + "」不是形状图层" }; }

        if (!findStrokeGraphic(getVectors(original))) {
            return { ok: false, msg: "「" + original.name + "」没有描边，无法拆分" };
        }

        var comp = null;
        try { comp = original.containingComp; } catch (e1) {}
        if (!comp) { return { ok: false, msg: "找不到所在合成" }; }

        var origName = original.name;

        // ---- 1. 复制一份 ----
        var dup = original.duplicate();
        dup.name = uniqueName(comp, origName + " 描边");

        // ---- 2. 删掉副本的填充，只留描边 ----
        for (var pass = 0; pass < 8; pass++) {
            var vv = getVectors(dup);
            if (!vv) { break; }
            var f = findFill(vv);
            if (!f) { break; }
            if (!removeGraphic(f.prop)) { break; }
        }

        // ---- 3. 删掉副本自己的效果控件（参数改由原图层提供，避免出现"改了没反应"的控件）----
        try {
            var parade = dup.property("ADBE Effect Parade");
            for (var i = parade.numProperties; i >= 1; i--) {
                try { parade.property(i).remove(); } catch (e2) {}
            }
        } catch (e3) {}

        // ---- 4. 挂到原图层下面 ----
        var posBefore = null;
        try { posBefore = dup.property("ADBE Transform Group").property("ADBE Position").value; } catch (e4) {}

        var parentOk = false;
        try { dup.parent = original; parentOk = true; }
        catch (e5) { LOG.push("! 设置父级失败: " + e5.toString()); }

        // 脚本设置父级不一定会自动补偿位置，检测一下，没补偿就手动换算
        if (parentOk) {
            var posAfter = null;
            try { posAfter = dup.property("ADBE Transform Group").property("ADBE Position").value; } catch (e6) {}
            if (posBefore && posAfter &&
                Math.abs(posAfter[0] - posBefore[0]) < 0.01 &&
                Math.abs(posAfter[1] - posBefore[1]) < 0.01) {
                try {
                    dup.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
                } catch (e7) {}
            }
        }

        // ---- 5. 表达式指向父级（原图层）的效果控件 ----
        bindToParent(dup, original);

        // ---- 6. 默认锁定 ----
        try { dup.locked = true; } catch (e8) {}

        var msg = "已拆分出「" + dup.name + "」：仅描边、已锁定、父级 = " + origName;
        if (bindErrors.length > 0) { msg += "（" + bindErrors.length + " 项绑定失败）"; }
        return { ok: true, msg: msg, layer: dup };
    }

    // 把 dup 的形状参数表达式指向 parent 的效果控件。
    // 用 thisLayer.parent 而不是图层名 —— 原图层改名后表达式不会断。
    function bindToParent(dup, original) {
        var P = "thisLayer.parent";

        var rp = getRectPath(dup);
        if (rp) {
            if (getFx(original, FXN.width) && getFx(original, FXN.height)) {
                setExpr(findIn(rp, "ADBE Vector Rect Size"),
                    "[" + P + ".effect(\"" + FXN.width + "\")(1), " +
                    P + ".effect(\"" + FXN.height + "\")(1)]", "拆分-大小");
            }
            if (getFx(original, FXN.offset)) {
                setExpr(findIn(rp, "ADBE Vector Rect Position"),
                    P + ".effect(\"" + FXN.offset + "\")(1)", "拆分-偏移");
            }
            if (getFx(original, FXN.radius)) {
                setExpr(findIn(rp, "ADBE Vector Rect Roundness"),
                    P + ".effect(\"" + FXN.radius + "\")(1)", "拆分-圆度");
            }
        }

        var s = findStrokeGraphic(getVectors(dup));
        if (s) {
            if (getFx(original, FXN.strokeWidth)) {
                setExpr(findInKey(s.prop, "width"),
                    P + ".effect(\"" + FXN.strokeWidth + "\")(1)", "拆分-描边宽度");
            }
            if (getFx(original, FXN.strokeOpacity)) {
                setExpr(findInKey(s.prop, "opacity"),
                    P + ".effect(\"" + FXN.strokeOpacity + "\")(1)", "拆分-描边不透明度");
            }
            if (getFx(original, FXN.strokeColor)) {
                setExpr(findInKey(s.prop, "color"),
                    P + ".effect(\"" + FXN.strokeColor + "\")(1)", "拆分-描边颜色");
            }
        }
    }

    // ============================================================
    //  创建窗口
    // ============================================================
    var IS_PANEL = false;
    try { IS_PANEL = (thisObj instanceof Panel); } catch (e0) { IS_PANEL = false; }

    var win;
    try {
        win = IS_PANEL
            ? thisObj
            : new Window("palette", "快速矩形", undefined, { resizeable: true });
    } catch (e1) {
        alert("创建窗口失败:\n" + e1.toString());
        return;
    }
    if (!win) { alert("无法获得面板对象"); return; }

    // ============================================================
    //  UI 辅助
    // ============================================================
    var ui = {};
    var currentMode = "full";          // "full" 精细面板 / "simple" 精简面板
    try {
        var savedMode = app.settings.getSetting("QuickRect", "panelMode");
        if (savedMode === "simple" || savedMode === "full") { currentMode = savedMode; }
    } catch (eMode) {}

    function addRowPanel(parent, title) {
        var p = parent.add("panel", undefined, title);
        trySet(p, "orientation", "column");
        trySet(p, "alignChildren", ["fill", "top"]);
        trySet(p, "alignment", ["fill", "top"]);
        trySet(p, "spacing", 4);
        return p;
    }

    function addLabeledGroup(parent) {
        var g = parent.add("group");
        trySet(g, "orientation", "row");
        trySet(g, "alignChildren", ["left", "center"]);
        trySet(g, "alignment", ["fill", "top"]);
        trySet(g, "spacing", 6);
        return g;
    }

    function addLabel(g, text) {
        var st = g.add("statictext", undefined, text);
        trySet(st, "alignment", ["left", "center"]);
        return st;
    }

    function addEdit(g, value, chars) {
        var et = g.add("edittext", undefined, String(value));
        trySet(et, "characters", chars);
        trySet(et, "alignment", ["fill", "center"]);
        return et;
    }

    function addKindDropdown(parent, defaultIndex) {
        var g = addLabeledGroup(parent);
        addLabel(g, "类型");
        var dd = g.add("dropdownlist", undefined, KIND_LABELS);
        trySet(dd, "alignment", ["fill", "center"]);
        try { dd.selection = defaultIndex; } catch (e) {}
        return dd;
    }

    function kindOf(dd) {
        try { return dd.selection ? dd.selection.index : 0; } catch (e) { return 0; }
    }

    // ============================================================
    //  构建 UI —— 精细面板
    // ============================================================
    function buildFullUI() {
        var host = ui.root;

        // 切换按钮只放在精细面板里；精简面板太窄，切换入口在「设置」弹窗中
        addModeSwitch(host);

        trySet(host, "orientation", "column");
        trySet(host, "alignChildren", ["fill", "top"]);
        trySet(host, "spacing", 6);
        trySet(host, "alignment", ["fill", "top"]);

        // ---- 预设 ----
        var pPre = addRowPanel(host, "预设");
        var rowA = pPre.add("group");
        var rowB = pPre.add("group");
        trySet(rowA, "orientation", "row");
        trySet(rowB, "orientation", "row");
        trySet(rowA, "alignChildren", "fill");
        trySet(rowB, "alignChildren", "fill");
        trySet(rowA, "alignment", ["fill", "top"]);
        trySet(rowB, "alignment", ["fill", "top"]);

        for (var i = 0; i < PRESETS.length; i++) {
            (function (p, top) {
                var row = top ? rowA : rowB;
                var b = row.add("button", undefined, p.name);
                trySet(b, "alignment", ["fill", "center"]);
                b.onClick = function () {
                    ui.etW.text = String(p.w);
                    ui.etH.text = String(p.h);
                    ui.etR.text = String(p.r);
                    ui.cbStroke.value = p.stroke;
                    ui.etSW.text = String(p.sw);
                };
            }(PRESETS[i], i < 2));
        }

        // ---- 尺寸 ----
        var pSize = addRowPanel(host, "尺寸");
        var g1 = addLabeledGroup(pSize);
        addLabel(g1, "宽");
        ui.etW = addEdit(g1, DEFAULTS.width, 6);
        addLabel(g1, "高");
        ui.etH = addEdit(g1, DEFAULTS.height, 6);
        var g2 = addLabeledGroup(pSize);
        addLabel(g2, "圆角");
        ui.etR = addEdit(g2, DEFAULTS.radius, 6);
        addLabel(g2, "px");

        // ---- 填充 ----
        var pFill = addRowPanel(host, "填充");
        ui.ddFill = addKindDropdown(pFill, DEFAULTS.fillKind);
        ui.stFillHint = pFill.add("statictext", undefined, "");
        trySet(ui.stFillHint, "alignment", ["fill", "top"]);

        // ---- 描边 ----
        var pStr = addRowPanel(host, "描边");
        ui.cbStroke = pStr.add("checkbox", undefined, "生成描边");
        trySet(ui.cbStroke, "alignment", ["left", "center"]);
        ui.cbStroke.value = DEFAULTS.enableStroke;
        ui.ddStroke = addKindDropdown(pStr, DEFAULTS.strokeKind);
        var g4 = addLabeledGroup(pStr);
        addLabel(g4, "宽度");
        ui.etSW = addEdit(g4, DEFAULTS.strokeWidth, 6);
        addLabel(g4, "px");
        ui.stStrokeHint = pStr.add("statictext", undefined, "");
        trySet(ui.stStrokeHint, "alignment", ["fill", "top"]);

        function refreshHints() {
            ui.stFillHint.text = (kindOf(ui.ddFill) !== 0)
                ? "渐变颜色需在时间轴点「编辑渐变」调整" : "";
            ui.stStrokeHint.text = (kindOf(ui.ddStroke) !== 0)
                ? "渐变颜色需在时间轴点「编辑渐变」调整" : "";
        }
        try { ui.ddFill.onChange = refreshHints; } catch (e) {}
        try { ui.ddStroke.onChange = refreshHints; } catch (e) {}
        refreshHints();

        // ---- 其他 ----
        var pMisc = addRowPanel(host, "其他");
        ui.cbCenter = pMisc.add("checkbox", undefined, "居中到合成");
        trySet(ui.cbCenter, "alignment", ["left", "center"]);
        ui.cbCenter.value = DEFAULTS.centerOnCreate;
        var g5 = addLabeledGroup(pMisc);
        addLabel(g5, "图层名");
        ui.etName = addEdit(g5, DEFAULTS.layerName, 12);

        // ---- 生成 ----
        ui.bGen = host.add("button", undefined, "生成矩形");
        trySet(ui.bGen, "alignment", ["fill", "top"]);

        // ---- 应用到选中图层 ----
        var pApply = addRowPanel(host, "应用到选中图层");
        var stApplyHint = pApply.add("statictext", undefined, "把选中矩形的填充 / 描边替换成上面的类型");
        trySet(stApplyHint, "alignment", ["fill", "top"]);
        ui.bApply = pApply.add("button", undefined, "替换类型");
        trySet(ui.bApply, "alignment", ["fill", "top"]);

        // ---- 拆分描边 ----
        var pSplit = addRowPanel(host, "拆分描边");
        var stSplitHint = pSplit.add("statictext", undefined,
            "复制出只有描边的图层：锁定 · 父级为原图层 · 参数跟随原图层");
        trySet(stSplitHint, "alignment", ["fill", "top"]);
        ui.bSplit = pSplit.add("button", undefined, "拆分描边");
        trySet(ui.bSplit, "alignment", ["fill", "top"]);
        ui.bSplit.onClick = function () { runSplit(); };

        function readCfg() {
            return {
                width: num(ui.etW.text, DEFAULTS.width),
                height: num(ui.etH.text, DEFAULTS.height),
                radius: num(ui.etR.text, DEFAULTS.radius),
                enableStroke: ui.cbStroke.value,
                fillKind: kindOf(ui.ddFill),
                strokeKind: kindOf(ui.ddStroke),
                strokeWidth: num(ui.etSW.text, DEFAULTS.strokeWidth),
                centerOnCreate: ui.cbCenter.value,
                layerName: ui.etName.text || DEFAULTS.layerName,
                fillColor: DEFAULTS.fillColor,
                fillOpacity: DEFAULTS.fillOpacity,
                strokeColor: DEFAULTS.strokeColor,
                strokeOpacity: DEFAULTS.strokeOpacity
            };
        }

        ui.bGen.onClick = function () { runGenerate(readCfg()); };

        ui.bApply.onClick = function () { runApply(readCfg()); };
    }

    // ============================================================
    //  共享操作
    // ============================================================
    function runGenerate(cfg) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            ui.stStatus.text = "请先打开一个合成";
            return;
        }

        var suppressed = false;
        try { app.beginSuppressDialogs(); suppressed = true; } catch (e0) {}

        try {
            app.beginUndoGroup("快速矩形");
            var layer = createRect(cfg, comp);
            app.endUndoGroup();

            if (bindErrors.length === 0) {
                ui.stStatus.text = "已生成：" + layer.name;
            } else {
                ui.stStatus.text = "已生成：" + layer.name + "（" + bindErrors.length + " 项失败）";
            }
        } catch (err) {
            try { app.endUndoGroup(); } catch (e1) {}
            ui.stStatus.text = "出错：" + err.toString();
        } finally {
            if (suppressed) { try { app.endSuppressDialogs(); } catch (e2) {} }
        }
    }

    function runApply(cfg) {
        if (!app.project.activeItem) {
            ui.stStatus.text = "请先打开一个合成";
            return;
        }

        var suppressed = false;
        try { app.beginSuppressDialogs(); suppressed = true; } catch (e0) {}

        try {
            app.beginUndoGroup("替换填充/描边类型");
            var r = applyToSelected(cfg);
            app.endUndoGroup();
            ui.stStatus.text = r.msg;
        } catch (err) {
            try { app.endUndoGroup(); } catch (e1) {}
            ui.stStatus.text = "出错：" + err.toString();
        } finally {
            if (suppressed) { try { app.endSuppressDialogs(); } catch (e2) {} }
        }
    }

    function runSplit() {
        if (!app.project.activeItem) {
            ui.stStatus.text = "请先打开一个合成";
            return;
        }

        var suppressed = false;
        try { app.beginSuppressDialogs(); suppressed = true; } catch (e0) {}

        try {
            app.beginUndoGroup("拆分描边");
            var r = splitStroke();
            app.endUndoGroup();
            ui.stStatus.text = r.msg;
        } catch (err) {
            try { app.endUndoGroup(); } catch (e1) {}
            ui.stStatus.text = "出错：" + err.toString();
        } finally {
            if (suppressed) { try { app.endSuppressDialogs(); } catch (e2) {} }
        }
    }

    // ============================================================
    //  模式切换按钮
    // ============================================================
    function addModeSwitch(parent) {
        var b = parent.add("button", undefined, modeLabel());
        trySet(b, "alignment", ["fill", "top"]);
        trySet(b, "preferredSize", [-1, 24]);
        b.onClick = function () {
            currentMode = (currentMode === "simple") ? "full" : "simple";
            buildUI();
        };
    }

    function modeLabel() {
        return (currentMode === "simple") ? "精细面板" : "精简面板";
    }

    // 精简模式 / 弹窗设置的默认值
    function cfgBase() {
        return {
            width: DEFAULTS.width,
            height: DEFAULTS.height,
            radius: DEFAULTS.radius,
            enableStroke: DEFAULTS.enableStroke,
            strokeWidth: DEFAULTS.strokeWidth,
            fillKind: DEFAULTS.fillKind,
            strokeKind: DEFAULTS.strokeKind,
            centerOnCreate: DEFAULTS.centerOnCreate,
            layerName: DEFAULTS.layerName,
            fillColor: DEFAULTS.fillColor,
            fillOpacity: DEFAULTS.fillOpacity,
            strokeColor: DEFAULTS.strokeColor,
            strokeOpacity: DEFAULTS.strokeOpacity
        };
    }

    function cfgFromPreset(p) {
        var c = cfgBase();
        c.width = p.w;
        c.height = p.h;
        c.radius = p.r;
        c.enableStroke = p.stroke;
        c.strokeWidth = p.sw;
        return c;
    }

    // ============================================================
    //  默认值读写（app.settings 持久化，重启后保留）
    // ============================================================
    function rgbToHex(a) {
        var r = Math.round(a[0] * 255);
        var g = Math.round(a[1] * 255);
        var b = Math.round(a[2] * 255);
        if (r < 0) { r = 0; }
        if (r > 255) { r = 255; }
        if (g < 0) { g = 0; }
        if (g > 255) { g = 255; }
        if (b < 0) { b = 0; }
        if (b > 255) { b = 255; }
        return (r << 16) | (g << 8) | b;
    }

    function hexToRgb(c) {
        return [((c >> 16) & 0xFF) / 255, ((c >> 8) & 0xFF) / 255, (c & 0xFF) / 255, 1];
    }

    function saveDefaults() {
        try {
            var s = [
                DEFAULTS.width, DEFAULTS.height, DEFAULTS.radius,
                DEFAULTS.fillKind, DEFAULTS.strokeKind, DEFAULTS.strokeWidth,
                DEFAULTS.centerOnCreate ? 1 : 0,
                rgbToHex(DEFAULTS.fillColor), rgbToHex(DEFAULTS.strokeColor),
                DEFAULTS.enableStroke ? 1 : 0
            ].join("|") + "|" + DEFAULTS.layerName;
            app.settings.saveSetting("QuickRect", "defaults", s);
        } catch (e) {}
    }

    function loadDefaults() {
        try {
            var s = app.settings.getSetting("QuickRect", "defaults");
            if (!s) { return; }
            var a = String(s).split("|");
            if (a.length < 11) { return; }
            DEFAULTS.width = num(a[0], DEFAULTS.width);
            DEFAULTS.height = num(a[1], DEFAULTS.height);
            DEFAULTS.radius = num(a[2], DEFAULTS.radius);
            DEFAULTS.fillKind = Math.round(num(a[3], 0));
            DEFAULTS.strokeKind = Math.round(num(a[4], 0));
            DEFAULTS.strokeWidth = num(a[5], DEFAULTS.strokeWidth);
            DEFAULTS.centerOnCreate = (a[6] === "1");
            DEFAULTS.fillColor = hexToRgb(Math.round(num(a[7], 0xFFFFFF)));
            DEFAULTS.strokeColor = hexToRgb(Math.round(num(a[8], 0xF5D98B)));
            DEFAULTS.enableStroke = (a[9] === "1");
            var ln = a.slice(10).join("|");
            if (ln) { DEFAULTS.layerName = ln; }
        } catch (e) {}
    }

    // ============================================================
    //  设置弹窗：调整「默认矩形」的各项数值
    // ============================================================
    function openSettings() {
        var dlg = null;
        try { dlg = new Window("dialog", "默认矩形设置"); } catch (e) { return; }

        trySet(dlg, "orientation", "column");
        trySet(dlg, "alignChildren", ["fill", "top"]);
        trySet(dlg, "spacing", 6);
        trySet(dlg, "margins", 12);

        var g1 = dlg.add("group");
        g1.add("statictext", undefined, "宽");
        var etW = g1.add("edittext", undefined, String(DEFAULTS.width));
        trySet(etW, "characters", 6);
        g1.add("statictext", undefined, "高");
        var etH = g1.add("edittext", undefined, String(DEFAULTS.height));
        trySet(etH, "characters", 6);

        var g2 = dlg.add("group");
        g2.add("statictext", undefined, "圆角");
        var etR = g2.add("edittext", undefined, String(DEFAULTS.radius));
        trySet(etR, "characters", 6);

        var g3 = dlg.add("group");
        g3.add("statictext", undefined, "填充");
        var ddFill = g3.add("dropdownlist", undefined, KIND_LABELS);
        try { ddFill.selection = DEFAULTS.fillKind; } catch (e1) {}
        var bFillCol = g3.add("button", undefined, "颜色");
        bFillCol.onClick = function () {
            var c = $.colorPicker(rgbToHex(DEFAULTS.fillColor));
            if (c !== -1 && c !== undefined && c !== null) { DEFAULTS.fillColor = hexToRgb(c); }
        };

        var g4 = dlg.add("group");
        var cbStroke = g4.add("checkbox", undefined, "描边");
        cbStroke.value = DEFAULTS.enableStroke;
        var ddStroke = g4.add("dropdownlist", undefined, KIND_LABELS);
        try { ddStroke.selection = DEFAULTS.strokeKind; } catch (e2) {}
        var bStrokeCol = g4.add("button", undefined, "颜色");
        bStrokeCol.onClick = function () {
            var c = $.colorPicker(rgbToHex(DEFAULTS.strokeColor));
            if (c !== -1 && c !== undefined && c !== null) { DEFAULTS.strokeColor = hexToRgb(c); }
        };

        var g5 = dlg.add("group");
        g5.add("statictext", undefined, "描边宽度");
        var etSW = g5.add("edittext", undefined, String(DEFAULTS.strokeWidth));
        trySet(etSW, "characters", 6);

        var g6 = dlg.add("group");
        var cbCenter = g6.add("checkbox", undefined, "居中到合成");
        cbCenter.value = DEFAULTS.centerOnCreate;

        var g7 = dlg.add("group");
        g7.add("statictext", undefined, "图层名");
        var etName = g7.add("edittext", undefined, DEFAULTS.layerName);
        trySet(etName, "characters", 12);

        // 模式切换入口放在这里 —— 精简面板上就不必再占一个按钮了
        var wantSwitch = false;
        var gSwitch = dlg.add("group");
        trySet(gSwitch, "alignment", "fill");
        var bSwitch = gSwitch.add("button", undefined,
            currentMode === "simple" ? "切换到精细面板" : "切换到精简面板");
        trySet(bSwitch, "alignment", ["fill", "center"]);
        bSwitch.onClick = function () {
            wantSwitch = true;
            try { dlg.close(); } catch (e3) {}
        };

        var gb = dlg.add("group");
        trySet(gb, "alignment", "right");
        gb.add("button", undefined, "确定", { name: "ok" });
        gb.add("button", undefined, "取消", { name: "cancel" });

        var ok = (dlg.show() === 1);

        if (ok) {
            DEFAULTS.width = num(etW.text, DEFAULTS.width);
            DEFAULTS.height = num(etH.text, DEFAULTS.height);
            DEFAULTS.radius = num(etR.text, DEFAULTS.radius);
            DEFAULTS.fillKind = ddFill.selection ? ddFill.selection.index : 0;
            DEFAULTS.enableStroke = cbStroke.value;
            DEFAULTS.strokeKind = ddStroke.selection ? ddStroke.selection.index : 0;
            DEFAULTS.strokeWidth = num(etSW.text, DEFAULTS.strokeWidth);
            DEFAULTS.centerOnCreate = cbCenter.value;
            DEFAULTS.layerName = etName.text || DEFAULTS.layerName;
            saveDefaults();
        }

        // 等弹窗真正关掉之后再重建面板，避免时序问题
        if (wantSwitch) {
            currentMode = (currentMode === "simple") ? "full" : "simple";
            buildUI();
            return;
        }

        if (ok && ui.stStatus) { ui.stStatus.text = "默认值已保存"; }
    }

    // ============================================================
    //  构建 UI —— 精简面板：三个窄按钮
    // ============================================================
    function buildSimpleUI() {
        var host = ui.root;

        trySet(host, "orientation", "column");
        trySet(host, "alignChildren", ["fill", "top"]);
        trySet(host, "spacing", 6);
        trySet(host, "alignment", ["fill", "top"]);

        ui.bGen = host.add("button", undefined, "生成");
        trySet(ui.bGen, "alignment", ["fill", "top"]);
        trySet(ui.bGen, "preferredSize", [-1, 34]);
        ui.bGen.onClick = function () { runGenerate(cfgBase()); };

        ui.bSplit = host.add("button", undefined, "拆分");
        trySet(ui.bSplit, "alignment", ["fill", "top"]);
        trySet(ui.bSplit, "preferredSize", [-1, 34]);
        ui.bSplit.onClick = function () { runSplit(); };

        ui.bSettings = host.add("button", undefined, "设置");
        trySet(ui.bSettings, "alignment", ["fill", "top"]);
        ui.bSettings.onClick = function () { openSettings(); };
    }

    // ============================================================
    //  清空窗口内容
    //  坑：win.removeAll() 在停靠面板上实测不生效（旧控件会残留在下方）。
    //      所以改成逐个 remove；万一 remove 也不灵，再把残留控件
    //      隐藏 + 压成 1x1，至少不占地方、不把新内容往下挤。
    // ============================================================
    function clearWin() {
        var removed = 0;
        try {
            for (var i = win.children.length - 1; i >= 0; i--) {
                try { win.remove(win.children[i]); removed++; } catch (e) {}
            }
        } catch (e1) {}

        try {
            for (var j = 0; j < win.children.length; j++) {
                var c = win.children[j];
                trySet(c, "visible", false);
                trySet(c, "maximumSize", [1, 1]);
                trySet(c, "preferredSize", [1, 1]);
                trySet(c, "minimumSize", [1, 1]);
            }
        } catch (e2) {}

        LOG.push("clearWin removed=" + removed);
    }

    // ============================================================
    //  构建 UI —— 每次按当前模式重建
    // ============================================================
    function buildUI() {
        clearWin();
        ui = {};
        ui.root = win;

        trySet(win, "orientation", "column");
        trySet(win, "alignChildren", ["fill", "top"]);
        trySet(win, "spacing", 6);
        trySet(win, "margins", 8);

        if (currentMode === "simple") { buildSimpleUI(); }
        else { buildFullUI(); }

        ui.stStatus = win.add("statictext", undefined, "就绪");
        trySet(ui.stStatus, "alignment", ["fill", "bottom"]);

        var onR = function () { try { this.layout.resize(); } catch (e1) {} };
        trySet(win, "onResizing", onR);
        trySet(win, "onResize", onR);

        var simple = (currentMode === "simple");
        trySet(win, "minimumSize", simple ? [68, 130] : [240, 430]);
        trySet(win, "preferredSize", simple ? [76, 170] : [290, 680]);

        try { win.layout.layout(true); } catch (e2) {}
        try { app.settings.saveSetting("QuickRect", "panelMode", currentMode); } catch (e3) {}
    }

    try {
        buildUI();
        LOG.push("UI 构建完成");
    } catch (be) {
        var msg = "面板构建失败：\n" + be.toString();
        try { if (be.line) { msg += "\n(第 " + be.line + " 行)"; } } catch (e9) {}
        alert(msg + "\n\n---- 构建日志 ----\n" + LOG.join("\n"));
        return;
    }

    // ============================================================
    //  显示
    // ============================================================
    var onResize = function () {
        try { this.layout.resize(); } catch (e6) {}
    };
    trySet(win, "onResizing", onResize);
    trySet(win, "onResize", onResize);

    if (!IS_PANEL) {
        try { win.show(); } catch (e7) { alert("显示窗口失败:\n" + e7.toString()); }
    }

}(this));
