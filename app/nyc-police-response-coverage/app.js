"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/frame/artifact.ts
  function isAppArtifact(value) {
    var _a;
    return typeof value === "object" && value !== null && value.version === "0.3" && value.kind === "app" && typeof ((_a = value.item) == null ? void 0 : _a.title) === "string" && typeof value.app === "object" && isMapReference(value.map);
  }
  function isScene(config) {
    return config.map.type === "webscene";
  }
  function isMapReference(value) {
    return typeof value === "object" && value !== null && (value.type === "webmap" && value.path === "./map.json" || value.type === "webscene" && value.path === "./scene.json");
  }

  // src/protocol/app-runtime-commands.ts
  var APP_REGION_BEHAVIOR_REINSTALL_ERROR = {
    code: "APP_REGION_BEHAVIOR_REINSTALL_FAILED",
    message: "The layout was applied, but some behaviors failed to reinstall."
  };
  function isAppRegionMutationResult(value) {
    if (typeof value !== "object" || value === null) return false;
    const result = value;
    return (result.status === "succeeded" || result.status === "partial") && result.layoutApplied === true && Array.isArray(result.reinstalledBehaviorIds) && result.reinstalledBehaviorIds.every((id) => typeof id === "string") && Array.isArray(result.failedBehaviors) && result.failedBehaviors.every(
      (failure2) => typeof failure2 === "object" && failure2 !== null && "id" in failure2 && typeof failure2.id === "string" && "code" in failure2 && typeof failure2.code === "string" && "message" in failure2 && typeof failure2.message === "string"
    );
  }
  var MAP_VIEW_COMMAND_TYPES = [
    "go-to-coordinates",
    "go-to-extent",
    "go-to-layer",
    "get-layer-schema",
    "query-feature-count",
    "query-features",
    "query-aggregate-statistics",
    "get-selection",
    "select-features",
    "clear-selection"
  ];
  function isMapViewCommandType(type) {
    return MAP_VIEW_COMMAND_TYPES.includes(type);
  }

  // src/frame/bridge.ts
  var COMMAND_MESSAGE_TYPE = "nova-app-command";
  var RESPONSE_MESSAGE_TYPE = "nova-app-response";
  var READY_MESSAGE_TYPE = "nova-app-ready";
  var UI_EVENT_MESSAGE_TYPE = "nova-app-ui-event";
  function installAppRuntimeBridge(controller, runtimeLocation = window.location) {
    var _a;
    if (!isManagedPreviewLocation(runtimeLocation)) {
      return () => void 0;
    }
    const context = readManagedBridgeContext(runtimeLocation);
    const parent = readParentIdentity();
    if (!context || !parent) {
      return () => void 0;
    }
    const handleMessage = (event) => {
      if (event.source !== window.parent || event.origin !== parent.expectedOrigin || !isCommandEnvelope(event.data) || event.data.command.nonce !== context.nonce || event.data.command.target.projectId !== context.projectId || normalizeRelativePath(event.data.command.target.relativePath) !== context.relativePath) {
        return;
      }
      void respond(controller, event.data.command, parent.targetOrigin);
    };
    window.addEventListener("message", handleMessage);
    (_a = controller.setUiEventPublisher) == null ? void 0 : _a.call(
      controller,
      (event) => {
        const envelope = {
          type: UI_EVENT_MESSAGE_TYPE,
          nonce: context.nonce,
          frameGeneration: context.frameGeneration,
          event
        };
        window.parent.postMessage(envelope, parent.targetOrigin);
      },
      {
        attachSelection: context.attachSelection,
        spatialSuggestions: context.spatialSuggestions
      }
    );
    window.addEventListener(
      "pagehide",
      () => {
        var _a2;
        window.removeEventListener("message", handleMessage);
        (_a2 = controller.setUiEventPublisher) == null ? void 0 : _a2.call(controller, null);
      },
      { once: true }
    );
    return () => {
      window.parent.postMessage(
        {
          type: READY_MESSAGE_TYPE,
          nonce: context.nonce,
          frameGeneration: context.frameGeneration
        },
        parent.targetOrigin
      );
    };
  }
  function readManagedBridgeContext(location) {
    var _a, _b, _c, _d, _e, _f;
    const parameters = new URLSearchParams(((_a = location.hash) != null ? _a : window.location.hash).slice(1));
    const nonce = (_c = (_b = parameters.get("nova-app-nonce")) == null ? void 0 : _b.trim()) != null ? _c : "";
    const projectId = (_e = (_d = parameters.get("nova-app-project-id")) == null ? void 0 : _d.trim()) != null ? _e : "";
    const relativePath = normalizeRelativePath((_f = parameters.get("nova-app-relative-path")) != null ? _f : "");
    const frameGeneration = Number(parameters.get("nova-app-frame-generation"));
    if (!nonce || !projectId || !relativePath || !Number.isSafeInteger(frameGeneration) || frameGeneration <= 0) {
      return null;
    }
    return {
      nonce,
      projectId,
      relativePath,
      frameGeneration,
      attachSelection: parameters.get("nova-app-attach-enabled") === "1",
      spatialSuggestions: parameters.get("nova-app-suggestions-enabled") === "1"
    };
  }
  function normalizeRelativePath(value) {
    return value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "");
  }
  async function respond(controller, command, parentOrigin) {
    let response;
    try {
      const result = await controller.applyOperation(
        command.type,
        command.payload
      );
      const partial = (command.type === "set-region" || command.type === "clear-region") && isAppRegionMutationResult(result) && result.status === "partial";
      response = {
        id: command.id,
        ok: !partial,
        result,
        ...partial ? {
          error: APP_REGION_BEHAVIOR_REINSTALL_ERROR
        } : {}
      };
    } catch (error) {
      response = {
        id: command.id,
        ok: false,
        error: {
          code: "APP_COMMAND_FAILED",
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
    window.parent.postMessage({ type: RESPONSE_MESSAGE_TYPE, response }, parentOrigin);
  }
  function isCommandEnvelope(value) {
    var _a, _b, _c, _d, _e;
    if (!value || typeof value !== "object") {
      return false;
    }
    const envelope = value;
    return envelope.type === COMMAND_MESSAGE_TYPE && typeof ((_a = envelope.command) == null ? void 0 : _a.id) === "string" && typeof ((_b = envelope.command) == null ? void 0 : _b.type) === "string" && typeof ((_c = envelope.command) == null ? void 0 : _c.payload) === "object" && envelope.command.payload !== null && typeof ((_d = envelope.command.target) == null ? void 0 : _d.projectId) === "string" && typeof ((_e = envelope.command.target) == null ? void 0 : _e.relativePath) === "string";
  }
  function isManagedPreviewLocation(location) {
    return location.protocol === "arcgis-nova:" && location.hostname === "preview";
  }
  function readParentIdentity() {
    var _a;
    const ancestor = (_a = readAncestorOrigin()) != null ? _a : readReferrerOrigin();
    if (!ancestor) {
      return null;
    }
    return ancestor === "file://" ? { expectedOrigin: "null", targetOrigin: "file://" } : { expectedOrigin: ancestor, targetOrigin: ancestor };
  }
  function readAncestorOrigin() {
    var _a;
    try {
      const ancestor = (_a = window.location.ancestorOrigins) == null ? void 0 : _a[0];
      return ancestor && ancestor !== "null" ? ancestor : null;
    } catch {
      return null;
    }
  }
  function readReferrerOrigin() {
    if (!document.referrer) {
      return null;
    }
    try {
      const parent = new URL(document.referrer);
      if (parent.protocol === "file:") {
        return "file://";
      }
      return parent.origin === "null" ? null : parent.origin;
    } catch {
      return null;
    }
  }

  // ../nova-types/src/app-runtime.ts
  var APP_RUNTIME_SCRIPT_TIMING = {
    defaultTimeoutMs: 3e4,
    maxTimeoutMs: 6e4
  };
  function appRuntimeScriptTimeoutMs(requested) {
    if (typeof requested !== "number" || !Number.isInteger(requested)) {
      return APP_RUNTIME_SCRIPT_TIMING.defaultTimeoutMs;
    }
    return Math.max(100, Math.min(requested, APP_RUNTIME_SCRIPT_TIMING.maxTimeoutMs));
  }

  // ../nova-types/src/chat.ts
  var FEATURE_SELECTION_SNAPSHOT_MAX_OBJECT_IDS = 50;

  // ../nova-types/src/common/gis/persistent-graphic-attributes.ts
  var PERSISTENT_GRAPHIC_ATTRIBUTE_PREFIX = "nova_";
  var PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS = {
    graphicId: "nova_graphicId",
    title: "nova_title",
    description: "nova_description",
    origin: "nova_origin",
    visible: "nova_visible",
    createdAt: "nova_createdAt",
    updatedAt: "nova_updatedAt",
    style: "nova_style"
  };
  var LEGACY_PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS = {
    graphicId: "graphicId",
    title: "title",
    description: "description",
    origin: "origin",
    visible: "visible",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    style: "novaStyle"
  };
  var LEGACY_ATTRIBUTE_NAMES = new Set(
    Object.values(LEGACY_PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS)
  );
  function isReservedPersistentGraphicAttributeName(name) {
    return name.startsWith(PERSISTENT_GRAPHIC_ATTRIBUTE_PREFIX);
  }
  function readPersistentGraphicAttributes(attributes) {
    const empty = {
      graphicId: null,
      title: null,
      description: null,
      origin: null,
      visible: null,
      createdAt: null,
      updatedAt: null,
      style: null,
      source: {}
    };
    if (!attributes) {
      return empty;
    }
    const isLegacy = !Object.keys(attributes).some(isReservedPersistentGraphicAttributeName);
    const keys = isLegacy ? LEGACY_PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS : PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS;
    const isNovaName = (name) => isLegacy ? LEGACY_ATTRIBUTE_NAMES.has(name) : isReservedPersistentGraphicAttributeName(name);
    const source = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (isNovaName(key)) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        source[key] = value;
      }
    }
    const origin = attributes[keys.origin];
    const style = attributes[keys.style];
    return {
      graphicId: readString(attributes[keys.graphicId]),
      title: readString(attributes[keys.title]),
      description: readString(attributes[keys.description]),
      origin: origin === "ui" || origin === "agent" || origin === "derived" || origin === "restore" || origin === "system" ? origin : null,
      visible: typeof attributes[keys.visible] === "boolean" ? attributes[keys.visible] : null,
      createdAt: readFiniteNumber(attributes[keys.createdAt]),
      updatedAt: readFiniteNumber(attributes[keys.updatedAt]),
      style: style && typeof style === "object" && !Array.isArray(style) ? structuredClone(style) : null,
      source
    };
  }
  function readString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  function readFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  // src/agent/output/app-map-persistence.ts
  function sanitizeCapturedAppMapDocument(value) {
    if (!isRecord(value)) {
      throw new Error("The open app did not return a native Web Map or Web Scene document.");
    }
    const sanitized = cloneRecord(value);
    removeRuntimeMetadata(sanitized);
    sanitizeLayerProperty(sanitized, "operationalLayers");
    sanitizeContainedLayerProperties(sanitized.baseMap, ["baseMapLayers", "referenceLayers"]);
    sanitizeContainedLayerProperties(sanitized.ground, ["layers"]);
    validateCapturedAppMapDocument(sanitized);
    return sanitized;
  }
  function validateCapturedAppMapDocument(document2) {
    if (typeof document2.version !== "string" || !/^\d+\.\d+$/u.test(document2.version)) {
      throw new Error("The captured app map document is missing a valid native version.");
    }
    if (!isLayerArray(document2.operationalLayers)) {
      throw new Error("The captured app map document has invalid operationalLayers.");
    }
    if (document2.baseMap !== void 0 && !isRecord(document2.baseMap)) {
      throw new Error("The captured app map document has an invalid baseMap.");
    }
  }
  function sanitizeContainedLayerProperties(value, properties) {
    if (!isRecord(value)) {
      return;
    }
    for (const property of properties) {
      sanitizeLayerProperty(value, property);
    }
  }
  function sanitizeLayerProperty(owner, property) {
    const layers = owner[property];
    if (!Array.isArray(layers)) {
      return;
    }
    owner[property] = layers.flatMap((layer) => {
      return [sanitizeLayer(layer)];
    });
  }
  function sanitizeLayer(value) {
    if (!isRecord(value)) {
      return cloneValue(value);
    }
    const sanitized = cloneRecord(value);
    removeRuntimeMetadata(sanitized);
    sanitizeLayerProperty(sanitized, "layers");
    return sanitized;
  }
  function removeRuntimeMetadata(value) {
    const sourceLayerType = isRecord(value.nova) && value.nova.sourceLayerType === "graphics" ? "graphics" : void 0;
    if (sourceLayerType) {
      value.nova = { sourceLayerType };
    } else {
      delete value.nova;
    }
    for (const key of TRANSIENT_RUNTIME_KEYS) {
      delete value[key];
    }
  }
  function cloneRecord(value) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
  }
  function cloneValue(value) {
    if (Array.isArray(value)) {
      return value.map(cloneValue);
    }
    return isRecord(value) ? cloneRecord(value) : value;
  }
  function isLayerArray(value) {
    return Array.isArray(value) && value.every(
      (layer) => isRecord(layer) && (layer.layers === void 0 || isLayerArray(layer.layers))
    );
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  var TRANSIENT_RUNTIME_KEYS = /* @__PURE__ */ new Set([
    "loadError",
    "loadStatus",
    "loaded",
    "updating",
    "visibleAtCurrentScale"
  ]);

  // src/agent/output/basemap-ids.ts
  var BUILT_IN_BASEMAPS = [
    { id: "dark-gray", title: "Dark Gray Canvas", is3D: false },
    { id: "dark-gray-3d", title: "Dark Gray Canvas", is3D: true },
    { id: "dark-gray-vector", title: "Dark Gray Canvas", is3D: false },
    { id: "gray", title: "Light Gray Canvas", is3D: false },
    { id: "gray-3d", title: "Light Gray Canvas", is3D: true },
    { id: "gray-vector", title: "Light Gray Canvas", is3D: false },
    { id: "hybrid", title: "Imagery with Labels", is3D: false },
    { id: "navigation-3d", title: "Navigation", is3D: true },
    { id: "navigation-dark-3d", title: "Navigation (Dark)", is3D: true },
    { id: "oceans", title: "Oceans", is3D: false },
    { id: "osm", title: "OpenStreetMap", is3D: false },
    { id: "osm-3d", title: "OpenStreetMap", is3D: true },
    { id: "satellite", title: "Imagery", is3D: false },
    { id: "streets", title: "Streets", is3D: false },
    { id: "streets-3d", title: "Streets", is3D: true },
    { id: "streets-dark-3d", title: "Streets (Dark)", is3D: true },
    { id: "streets-navigation-vector", title: "World Navigation Map", is3D: false },
    { id: "streets-night-vector", title: "World Street Map (Night)", is3D: false },
    { id: "streets-relief-vector", title: "World Street Map (with Relief)", is3D: false },
    { id: "streets-vector", title: "Streets", is3D: false },
    { id: "terrain", title: "Terrain with Labels", is3D: false },
    { id: "topo", title: "Topographic", is3D: false },
    { id: "topo-3d", title: "Topographic", is3D: true },
    { id: "topo-vector", title: "Topographic", is3D: false }
  ];
  var DEFAULT_BLANK_MAP_BASEMAP_ID = "topo-vector";
  var DEFAULT_BLANK_SCENE_BASEMAP_ID = "hybrid";
  var DEFAULT_BLANK_MAP_SPATIAL_REFERENCE = Object.freeze({
    wkid: 102100,
    latestWkid: 3857
  });
  var DEFAULT_BLANK_MAP_BASEMAP_DOCUMENT = Object.freeze({
    title: "Topographic",
    baseMapLayers: [
      {
        id: "world-hillshade-layer",
        title: "World Hillshade",
        url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
        layerType: "ArcGISTiledMapServiceLayer",
        showLegend: false,
        visibility: true,
        opacity: 1
      },
      {
        id: "topo-vector-base-layer",
        title: "World Topo",
        styleUrl: "https://cdn.arcgis.com/sharing/rest/content/items/7dc6cea0b1764a1f9af2e679f642f0f5/resources/styles/root.json",
        layerType: "VectorTileLayer",
        visibility: true,
        opacity: 1
      }
    ]
  });
  var DEFAULT_BLANK_SCENE_BASEMAP_DOCUMENT = Object.freeze({
    title: "Imagery with Labels",
    baseMapLayers: [
      {
        id: "hybrid-base-layer",
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        layerType: "ArcGISTiledMapServiceLayer",
        title: "World Imagery",
        showLegend: false,
        visibility: true,
        opacity: 1
      },
      {
        id: "hybrid-reference-layer",
        styleUrl: "https://cdn.arcgis.com/sharing/rest/content/items/30d6b8271e1849cd9c3042060001f425/resources/styles/root.json",
        layerType: "VectorTileLayer",
        title: "Hybrid Reference Layer",
        isReference: true,
        showLegend: false,
        visibility: true,
        opacity: 1
      }
    ]
  });
  var BUILT_IN_BASEMAP_IDS = BUILT_IN_BASEMAPS.map(
    (basemap) => basemap.id
  );
  function isPortalItemId2(value) {
    return /^[a-f0-9]{32}$/iu.test(value.trim());
  }
  function describeBuiltInBasemapIds() {
    return BUILT_IN_BASEMAP_IDS.join(", ");
  }

  // src/agent/output/owned-graphics-layer.ts
  var OWNED_GRAPHICS_LAYER_PREFIX = "nova-graphics-";
  var DEFAULT_COLLECTION_ID = "project-graphics";
  var GEOMETRY_LAYER_SUFFIX = /--(?:polyline|polygon|multipoint)$/u;
  function readOwnedGraphicsCollectionId(layerId) {
    return layerId.startsWith(OWNED_GRAPHICS_LAYER_PREFIX) ? layerId.slice(OWNED_GRAPHICS_LAYER_PREFIX.length).replace(GEOMETRY_LAYER_SUFFIX, "") : null;
  }
  function isDefaultOwnedGraphicsCollectionId(collectionId) {
    return collectionId === DEFAULT_COLLECTION_ID;
  }
  var PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS_LIST = [
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.graphicId,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.title,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.description,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.origin,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.visible,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.createdAt,
    PERSISTENT_GRAPHIC_ATTRIBUTE_KEYS.updatedAt
  ];
  function readOwnedGraphicId(graphic) {
    return readPersistentGraphicAttributes(isRecord2(graphic.attributes) ? graphic.attributes : null).graphicId;
  }
  function toPersistentGraphicDescriptor(graphic, collectionId, collectionTitle, index) {
    var _a, _b, _c, _d, _e;
    const attributes = readPersistentGraphicAttributes(
      isRecord2(graphic.attributes) ? graphic.attributes : null
    );
    const geometry = requireGraphicGeometry(graphic, index);
    const geometryType = inferPersistentGraphicGeometryType(geometry);
    const { title, description } = attributes;
    const style = attributes.style;
    const symbol = isRecord2(graphic.symbol) ? structuredClone(graphic.symbol) : void 0;
    const popupTemplate = isRecord2(graphic.popupTemplate) ? structuredClone(graphic.popupTemplate) : void 0;
    const readTimestamp = Date.now();
    return {
      graphicId: (_a = attributes.graphicId) != null ? _a : `graphic-${index + 1}`,
      ...title ? { title } : {},
      ...description ? { description } : {},
      geometryType,
      geometry,
      ...style ? { style } : {},
      ...Object.keys(attributes.source).length > 0 ? { attributes: attributes.source } : {},
      ...symbol ? { symbol } : {},
      ...popupTemplate ? { popupTemplate } : {},
      visible: (_b = attributes.visible) != null ? _b : true,
      origin: (_c = attributes.origin) != null ? _c : "agent",
      ...isDefaultOwnedGraphicsCollectionId(collectionId) ? {} : {
        group: {
          groupId: collectionId,
          groupName: collectionTitle
        }
      },
      createdAt: (_d = attributes.createdAt) != null ? _d : readTimestamp,
      updatedAt: (_e = attributes.updatedAt) != null ? _e : readTimestamp
    };
  }
  function toPersistentGraphicSummaryDescriptor(graphic) {
    return {
      graphicId: graphic.graphicId,
      ...graphic.title ? { title: graphic.title } : {},
      ...graphic.description ? { description: graphic.description } : {},
      geometrySummary: {
        geometryType: graphic.geometryType,
        spatialReferenceWkid: readSpatialReferenceWkid(graphic.geometry),
        ...readGeometryExtent(graphic.geometry) ? { extent: readGeometryExtent(graphic.geometry) } : {},
        ...readGeometryPointCount(graphic.geometryType, graphic.geometry) ? { pointCount: readGeometryPointCount(graphic.geometryType, graphic.geometry) } : {}
      },
      ...graphic.style ? { style: graphic.style } : {},
      visible: graphic.visible,
      origin: graphic.origin,
      ...graphic.group ? { group: graphic.group } : {},
      createdAt: graphic.createdAt,
      updatedAt: graphic.updatedAt
    };
  }
  function requireGraphicGeometry(graphic, index) {
    if (!isRecord2(graphic.geometry)) {
      throw new Error(`Owned app graphic at index ${index} is missing geometry.`);
    }
    return structuredClone(graphic.geometry);
  }
  function inferPersistentGraphicGeometryType(geometry) {
    if ("x" in geometry && "y" in geometry) {
      return "point";
    }
    if ("paths" in geometry) {
      return "polyline";
    }
    if ("rings" in geometry) {
      return "polygon";
    }
    if ("points" in geometry) {
      return "multipoint";
    }
    if ("xmin" in geometry && "ymin" in geometry && "xmax" in geometry && "ymax" in geometry) {
      return "extent";
    }
    throw new Error("Owned app graphic geometry uses an unsupported shape.");
  }
  function readSpatialReferenceWkid(geometry) {
    const reference = isRecord2(geometry.spatialReference) ? geometry.spatialReference : null;
    return typeof (reference == null ? void 0 : reference.wkid) === "number" ? reference.wkid : void 0;
  }
  function readGeometryExtent(geometry) {
    if ("xmin" in geometry && "ymin" in geometry && "xmax" in geometry && "ymax" in geometry) {
      return {
        xmin: geometry.xmin,
        ymin: geometry.ymin,
        xmax: geometry.xmax,
        ymax: geometry.ymax,
        ...geometry.spatialReference ? { spatialReference: geometry.spatialReference } : {}
      };
    }
    return void 0;
  }
  function readGeometryPointCount(geometryType, geometry) {
    switch (geometryType) {
      case "point":
        return 1;
      case "multipoint":
        return "points" in geometry ? geometry.points.length : void 0;
      case "polyline":
        return "paths" in geometry ? geometry.paths.reduce((count, path) => count + path.length, 0) : void 0;
      case "polygon":
        return "rings" in geometry ? geometry.rings.reduce((count, ring) => count + ring.length, 0) : void 0;
      case "extent":
        return 4;
      default:
        return void 0;
    }
  }
  function isRecord2(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // src/frame/dom-snapshot.ts
  var DEFAULT_DOM_ROOT = "page";
  function readDomRoot(value) {
    return value === "page" || value === "main" ? value : DEFAULT_DOM_ROOT;
  }
  function buildDomNodeSnapshot(element2, options, depth = 0) {
    options.counter.count += 1;
    const text = readSnapshotText(element2, options.maxTextLength);
    const children = [];
    const childElements = [...element2.children];
    if (depth < options.maxDepth) {
      for (let index = 0; index < childElements.length; index += 1) {
        if (options.counter.count >= options.maxNodes) {
          options.counter.truncated = true;
          break;
        }
        children.push(
          buildDomNodeSnapshot(
            childElements[index],
            {
              ...options,
              path: `${options.path}.${index}`
            },
            depth + 1
          )
        );
      }
    } else if (childElements.length > 0) {
      options.counter.truncated = true;
    }
    return {
      ref: `${options.snapshotId}:${options.path}`,
      tagName: element2.tagName.toLowerCase(),
      ...element2.getAttribute("role") ? { role: element2.getAttribute("role") } : {},
      ...element2.id ? { id: element2.id } : {},
      ...element2.getAttribute("data-region") ? { region: element2.getAttribute("data-region") } : {},
      ...element2.getAttribute("data-widget-type") ? { widgetType: element2.getAttribute("data-widget-type") } : {},
      ...text ? { text } : {},
      childCount: childElements.length,
      ...children.length > 0 ? { children } : {}
    };
  }
  function readSnapshotText(element2, maxTextLength) {
    var _a, _b;
    const text = (_b = (_a = element2.textContent) == null ? void 0 : _a.replace(/\s+/gu, " ").trim()) != null ? _b : "";
    if (!text || maxTextLength <= 0) {
      return void 0;
    }
    return text.slice(0, maxTextLength);
  }

  // src/frame/feature-collections.ts
  function isEmbeddedFeatureCollection(value) {
    return isRecord3(value) && isRecord3(value.featureCollection);
  }
  function isEmbeddedGraphicsCollection(value) {
    return isEmbeddedFeatureCollection(value) && isRecord3(value.nova) && value.nova.sourceLayerType === "graphics";
  }
  function withGraphicsLayerCollections(document2, liveLayers, omittedLayerIds) {
    if (!isRecord3(document2)) {
      return document2;
    }
    const captured = Array.isArray(document2.operationalLayers) ? [...document2.operationalLayers] : [];
    const operationalLayers = insertGraphicsCollections(captured, liveLayers, omittedLayerIds);
    return operationalLayers === captured ? document2 : { ...document2, operationalLayers };
  }
  function insertGraphicsCollections(captured, liveLayers, omittedLayerIds) {
    var _a, _b, _c;
    let result = captured;
    let insertAt = 0;
    for (const live of liveLayers) {
      if (!live.id || omittedLayerIds.has(live.id)) {
        continue;
      }
      const capturedIndex = result.findIndex((entry) => isRecord3(entry) && entry.id === live.id);
      if (capturedIndex !== -1) {
        const children = (_c = (_b = (_a = live.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
        const capturedLayer = result[capturedIndex];
        if (children.length > 0 && isRecord3(capturedLayer)) {
          const capturedChildren = Array.isArray(capturedLayer.layers) ? capturedLayer.layers : [];
          const nextChildren = insertGraphicsCollections(capturedChildren, children, omittedLayerIds);
          if (nextChildren !== capturedChildren) {
            result = [...result];
            result[capturedIndex] = { ...capturedLayer, layers: nextChildren };
          }
        }
        insertAt = capturedIndex + 1;
        continue;
      }
      if (live.type !== "graphics") {
        continue;
      }
      result = [...result];
      result.splice(insertAt, 0, serializeGraphicsLayer(live));
      insertAt += 1;
    }
    return result;
  }
  function serializeGraphicsLayer(layer) {
    var _a, _b, _c, _d, _e;
    const grouped = /* @__PURE__ */ new Map();
    for (const graphic of (_c = (_b = (_a = layer.graphics) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []) {
      const serialized = toJson(graphic);
      const liveGeometry = isRecord3(graphic) && isRecord3(graphic.geometry) ? graphic.geometry : void 0;
      const serializedGeometry = isRecord3(serialized) && isRecord3(serialized.geometry) ? serialized.geometry : void 0;
      const geometry = liveGeometry != null ? liveGeometry : serializedGeometry;
      const geometryType = typeof (geometry == null ? void 0 : geometry.type) === "string" ? geometry.type : "unknown";
      grouped.set(geometryType, [...(_d = grouped.get(geometryType)) != null ? _d : [], serialized]);
    }
    const collectionLayers = [...grouped.entries()].map(([geometryType, features]) => {
      const webMapGeometryType = toWebMapGeometryType(geometryType);
      return {
        layerDefinition: {
          name: layer.title || layer.id || "Graphics",
          ...webMapGeometryType ? { geometryType: webMapGeometryType } : {}
        },
        featureSet: {
          ...webMapGeometryType ? { geometryType: webMapGeometryType } : {},
          features
        }
      };
    });
    return {
      id: layer.id,
      title: layer.title || layer.id,
      layerType: "ArcGISFeatureLayer",
      opacity: (_e = layer.opacity) != null ? _e : 1,
      visibility: layer.visible !== false,
      ...layer.listMode ? { listMode: layer.listMode } : {},
      featureCollection: { layers: collectionLayers },
      nova: { sourceLayerType: "graphics" }
    };
  }
  function toWebMapGeometryType(type) {
    return {
      point: "esriGeometryPoint",
      multipoint: "esriGeometryMultipoint",
      polyline: "esriGeometryPolyline",
      polygon: "esriGeometryPolygon",
      mesh: "esriGeometryMesh"
    }[type];
  }
  function readEmbeddedFeatureCollectionLayer(FeatureLayer, json) {
    const layer = new FeatureLayer();
    layer.read(json, { origin: "web-map" });
    layer.read(json, { origin: "web-scene" });
    return layer;
  }
  function readEmbeddedGraphicsCollectionLayer(GraphicsLayer, Graphic, json) {
    const collection = isRecord3(json.featureCollection) && Array.isArray(json.featureCollection.layers) ? json.featureCollection.layers : [];
    const graphics = collection.flatMap((entry) => {
      if (!isRecord3(entry) || !isRecord3(entry.featureSet) || !Array.isArray(entry.featureSet.features)) {
        return [];
      }
      return entry.featureSet.features.flatMap((feature) => {
        var _a, _b;
        if (!isRecord3(feature)) {
          return [];
        }
        return [(_b = (_a = Graphic.fromJSON) == null ? void 0 : _a.call(Graphic, feature, { origin: "web-map" })) != null ? _b : new Graphic(feature)];
      });
    });
    return new GraphicsLayer({
      id: json.id,
      title: json.title,
      opacity: json.opacity,
      visible: json.visibility !== false,
      ...typeof json.listMode === "string" ? { listMode: json.listMode } : {},
      graphics
    });
  }
  function splitRuntimeFeatureCollections(document2, scene) {
    const collections = [];
    const split = (value, parentId) => {
      const layers = Array.isArray(value) ? value : [];
      return layers.flatMap((layer, index) => {
        if (!isRecord3(layer)) {
          return [layer];
        }
        const graphics = isEmbeddedGraphicsCollection(layer);
        if (graphics || scene && isEmbeddedFeatureCollection(layer)) {
          collections.push({
            index,
            json: layer,
            ...parentId ? { parentId } : {},
            sourceLayerType: graphics ? "graphics" : "feature"
          });
          return [];
        }
        if (Array.isArray(layer.layers)) {
          return [
            {
              ...layer,
              layers: split(layer.layers, typeof layer.id === "string" ? layer.id : parentId)
            }
          ];
        }
        return [layer];
      });
    };
    const operationalLayers = split(document2.operationalLayers);
    return collections.length === 0 ? { document: document2, collections } : { document: { ...document2, operationalLayers }, collections };
  }
  function withSceneFeatureCollections(document2, liveLayers, omittedLayerIds) {
    if (!isRecord3(document2)) {
      return document2;
    }
    const captured = Array.isArray(document2.operationalLayers) ? [...document2.operationalLayers] : [];
    const operationalLayers = insertSceneCollections(captured, liveLayers, omittedLayerIds);
    return operationalLayers === captured ? document2 : { ...document2, operationalLayers };
  }
  function insertSceneCollections(captured, liveLayers, omittedLayerIds) {
    var _a, _b, _c, _d;
    let result = captured;
    let insertAt = 0;
    for (const live of liveLayers) {
      if (!live.id) {
        continue;
      }
      const capturedIndex = result.findIndex((entry) => isRecord3(entry) && entry.id === live.id);
      if (capturedIndex !== -1) {
        const children = (_c = (_b = (_a = live.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
        const capturedLayer = result[capturedIndex];
        if (children.length > 0 && isRecord3(capturedLayer)) {
          const capturedChildren = Array.isArray(capturedLayer.layers) ? capturedLayer.layers : [];
          const nextChildren = insertSceneCollections(capturedChildren, children, omittedLayerIds);
          if (nextChildren !== capturedChildren) {
            result = [...result];
            result[capturedIndex] = { ...capturedLayer, layers: nextChildren };
          }
        }
        insertAt = capturedIndex + 1;
        continue;
      }
      const resourceInfo = !omittedLayerIds.has(live.id) && isMemoryFeatureLayer(live) ? live.resourceInfo : void 0;
      if (!isEmbeddedFeatureCollection(resourceInfo)) {
        continue;
      }
      result = [...result];
      result.splice(insertAt, 0, {
        ...structuredClone(resourceInfo),
        id: live.id,
        title: live.title || "Layer",
        opacity: (_d = live.opacity) != null ? _d : 1,
        visibility: live.visible !== false
      });
      insertAt += 1;
    }
    return result;
  }
  function overlayLiveFeatureCollectionDisplay(target, live) {
    if (!isRecord3(target.featureCollection) || !isMemoryFeatureLayer(live)) {
      return;
    }
    const display = readLiveDisplay(live);
    applyDisplay(target, display);
    const layers = Array.isArray(target.featureCollection.layers) ? target.featureCollection.layers : [];
    if (layers.length === 1 && isRecord3(layers[0])) {
      applyDisplay(layers[0], display);
    }
  }
  function readLiveDisplay(live) {
    const cleared = { drawingInfo: [], definition: [], popupInfo: false };
    const drawingInfo = {};
    if (live.renderer) {
      drawingInfo.renderer = toJson(live.renderer);
    }
    if (Array.isArray(live.labelingInfo)) {
      drawingInfo.labelingInfo = live.labelingInfo.map(toJson);
    } else if (holdsNothing(live, "labelingInfo")) {
      cleared.drawingInfo.push("labelingInfo");
    }
    const definition = {};
    if (typeof live.definitionExpression === "string" && live.definitionExpression) {
      definition.definitionExpression = live.definitionExpression;
    } else if (holdsNothing(live, "definitionExpression")) {
      cleared.definition.push("definitionExpression");
    }
    if (live.featureReduction) {
      definition.featureReduction = toJson(live.featureReduction);
    } else if (holdsNothing(live, "featureReduction")) {
      cleared.definition.push("featureReduction");
    }
    if (live.elevationInfo) {
      definition.elevationInfo = toJson(live.elevationInfo);
    }
    if (!live.popupTemplate && holdsNothing(live, "popupTemplate")) {
      cleared.popupInfo = true;
    }
    return {
      drawingInfo,
      definition,
      ...live.popupTemplate ? { popupInfo: toJson(live.popupTemplate) } : {},
      cleared
    };
  }
  function holdsNothing(live, key) {
    if (!(key in live)) {
      return false;
    }
    const value = live[key];
    return value === null || value === void 0 || value === "";
  }
  function applyDisplay(target, display) {
    const definition = isRecord3(target.layerDefinition) ? { ...target.layerDefinition } : {};
    const drawingInfo = isRecord3(definition.drawingInfo) ? { ...definition.drawingInfo } : {};
    for (const key of display.cleared.definition) {
      delete definition[key];
    }
    for (const key of display.cleared.drawingInfo) {
      delete drawingInfo[key];
    }
    target.layerDefinition = {
      ...definition,
      ...display.definition,
      drawingInfo: { ...drawingInfo, ...display.drawingInfo }
    };
    if (display.popupInfo !== void 0) {
      target.popupInfo = display.popupInfo;
    } else if (display.cleared.popupInfo) {
      delete target.popupInfo;
    }
  }
  function isMemoryFeatureLayer(layer) {
    return layer.type === "feature" && !layer.url && isRecord3(layer.source) && layer.source.type === "memory";
  }
  function toJson(value) {
    return isRecord3(value) && typeof value.toJSON === "function" ? value.toJSON() : value;
  }
  function isRecord3(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // src/frame/values.ts
  function serializeValue(value) {
    if (value && typeof value === "object" && typeof value.toJSON === "function") {
      return value.toJSON();
    }
    return value;
  }
  function isRecord4(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // src/frame/feature-helpers.ts
  function toSelectionObjectId(layerId, featureId) {
    if (!/^-?\d+$/u.test(featureId)) {
      throw new Error(
        `Feature id ${featureId} cannot be mapped to a stable object id for live selection highlighting on layer ${layerId}.`
      );
    }
    const objectId = Number(featureId);
    if (!Number.isSafeInteger(objectId)) {
      throw new Error(
        `Feature id ${featureId} is outside the supported object id range for live selection highlighting on layer ${layerId}.`
      );
    }
    return objectId;
  }
  function toQueryPreviewFeatureDescriptor(layerId, objectIdField, feature, index) {
    var _a;
    return {
      layerId,
      featureId: resolveFeatureId(layerId, objectIdField, feature, index),
      attributes: (_a = feature.attributes) != null ? _a : {}
    };
  }
  function toQueryFeatureDescriptor(layerId, objectIdField, feature, index) {
    var _a;
    return {
      layerId,
      featureId: resolveFeatureId(layerId, objectIdField, feature, index),
      attributes: (_a = feature.attributes) != null ? _a : {},
      geometry: serializeValue(feature.geometry)
    };
  }
  function resolveFeatureId(layerId, objectIdField, feature, index) {
    var _a, _b, _c, _d, _e;
    const attributes = (_a = feature.attributes) != null ? _a : {};
    const featureId = (_e = (_d = (_c = (_b = feature.getObjectId) == null ? void 0 : _b.call(feature)) != null ? _c : objectIdField ? attributes[objectIdField] : void 0) != null ? _d : attributes.OBJECTID) != null ? _e : `${layerId}:${index}`;
    return String(featureId);
  }
  function toGeoprocessingFeatureCollection(layer, features, layerId, resultSpatialReference) {
    var _a, _b, _c, _d, _e;
    const fields = ((_a = layer.fields) != null ? _a : []).flatMap((field) => {
      if (!field.name) {
        return [];
      }
      return [
        {
          name: field.name,
          ...field.alias ? { alias: field.alias } : {},
          type: toGeoprocessingFieldType(field.type),
          ...typeof field.nullable === "boolean" ? { nullable: field.nullable } : {}
        }
      ];
    });
    const geometryType = toGeoprocessingGeometryType(layer.geometryType);
    const resolvedSpatialReference = (_e = (_b = toSpatialReference(serializeValue(resultSpatialReference))) != null ? _b : toSpatialReference(serializeValue(layer.spatialReference))) != null ? _e : toSpatialReference(
      serializeValue(
        (_d = (_c = features[0]) == null ? void 0 : _c.geometry) == null ? void 0 : _d.spatialReference
      )
    );
    const spatialReference = resolvedSpatialReference ? { ...resolvedSpatialReference } : void 0;
    return {
      layers: [
        {
          layerDefinition: {
            id: layerId,
            ...layer.title ? { name: layer.title } : {},
            ...geometryType ? { geometryType } : {},
            ...layer.objectIdField ? { objectIdField: layer.objectIdField } : {},
            ...layer.displayField ? { displayField: layer.displayField } : {},
            ...spatialReference ? { spatialReference } : {},
            ...fields.length > 0 ? { fields } : {}
          },
          featureSet: {
            ...geometryType ? { geometryType } : {},
            ...spatialReference ? { spatialReference } : {},
            ...fields.length > 0 ? { fields } : {},
            features: features.map((feature) => ({
              ...feature.attributes ? { attributes: { ...feature.attributes } } : {},
              ...feature.geometry ? { geometry: serializeValue(feature.geometry) } : {}
            }))
          }
        }
      ]
    };
  }
  function toGeoprocessingGeometryType(geometryType) {
    switch (geometryType) {
      case "point":
        return "esriGeometryPoint";
      case "polyline":
        return "esriGeometryPolyline";
      case "polygon":
        return "esriGeometryPolygon";
      case "multipoint":
        return "esriGeometryMultipoint";
      default:
        return geometryType;
    }
  }
  function toGeoprocessingFieldType(fieldType) {
    switch (fieldType) {
      case "oid":
        return "esriFieldTypeOID";
      case "string":
        return "esriFieldTypeString";
      case "small-integer":
        return "esriFieldTypeSmallInteger";
      case "integer":
        return "esriFieldTypeInteger";
      case "long":
        return "esriFieldTypeBigInteger";
      case "single":
        return "esriFieldTypeSingle";
      case "double":
        return "esriFieldTypeDouble";
      case "date":
        return "esriFieldTypeDate";
      case "guid":
        return "esriFieldTypeGUID";
      case "global-id":
        return "esriFieldTypeGlobalID";
      default:
        return fieldType != null ? fieldType : "esriFieldTypeString";
    }
  }
  function aggregateStatisticValue(records, definition) {
    if (definition.statisticType === "count") {
      return records.length;
    }
    const values = records.map((record) => definition.fieldName ? record[definition.fieldName] : void 0).filter((value) => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) {
      return null;
    }
    switch (definition.statisticType) {
      case "sum":
        return values.reduce((total, value) => total + value, 0);
      case "avg":
        return values.reduce((total, value) => total + value, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "stddev": {
        const mean = values.reduce((total, value) => total + value, 0) / values.length;
        const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
        return Math.sqrt(variance);
      }
      default:
        return null;
    }
  }
  function sortAggregateRows(rows, orderByFields) {
    const [first] = orderByFields;
    if (!first) {
      return rows;
    }
    const [fieldName, rawDirection] = first.trim().split(/\s+/u);
    const direction = (rawDirection == null ? void 0 : rawDirection.toUpperCase()) === "DESC" ? -1 : 1;
    return [...rows].sort((left, right) => {
      var _a, _b, _c, _d;
      const leftValue = (_b = left.statistics[fieldName]) != null ? _b : (_a = left.groupValues) == null ? void 0 : _a[fieldName];
      const rightValue = (_d = right.statistics[fieldName]) != null ? _d : (_c = right.groupValues) == null ? void 0 : _c[fieldName];
      if (leftValue === rightValue) {
        return 0;
      }
      if (leftValue == null) {
        return 1;
      }
      if (rightValue == null) {
        return -1;
      }
      return leftValue > rightValue ? direction : -direction;
    });
  }
  function applySelectionMode(currentIds, requestedIds, mode) {
    switch (mode) {
      case "replace":
        return [...requestedIds];
      case "add":
        return [.../* @__PURE__ */ new Set([...currentIds, ...requestedIds])];
      case "remove":
        return currentIds.filter((id) => !requestedIds.includes(id));
      default:
        return [...requestedIds];
    }
  }
  function buildFeatureIdWhereClause(objectIdField, featureIds) {
    if (!objectIdField || featureIds.length === 0) {
      return void 0;
    }
    const literals = featureIds.map(
      (featureId) => /^-?\d+(?:\.\d+)?$/u.test(featureId) ? featureId : `'${featureId.replace(/'/gu, "''")}'`
    );
    return `${objectIdField} IN (${literals.join(", ")})`;
  }
  function orderFeaturesByRequestedIds(features, featureIds) {
    const order = new Map(featureIds.map((featureId, index) => [featureId, index]));
    return [...features].sort(
      (left, right) => {
        var _a, _b;
        return ((_a = order.get(left.featureId)) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = order.get(right.featureId)) != null ? _b : Number.MAX_SAFE_INTEGER);
      }
    );
  }
  function toServiceSpatialRelationship(value) {
    switch (value) {
      case "within-filter":
        return "contains";
      case "contains-filter":
        return "within";
      default:
        return value;
    }
  }
  function toExtent(value) {
    if (!isRecord4(value)) {
      return void 0;
    }
    return typeof value.xmin === "number" && typeof value.ymin === "number" && typeof value.xmax === "number" && typeof value.ymax === "number" ? {
      xmin: value.xmin,
      ymin: value.ymin,
      xmax: value.xmax,
      ymax: value.ymax,
      ...toSpatialReference(value.spatialReference) ? { spatialReference: toSpatialReference(value.spatialReference) } : {}
    } : void 0;
  }
  function toSpatialReference(value) {
    if (!isRecord4(value) || typeof value.wkid !== "number") {
      return void 0;
    }
    return {
      wkid: value.wkid,
      ...typeof value.wkt === "string" ? { wkt: value.wkt } : {}
    };
  }
  function toEpochMillis(value) {
    return value instanceof Date ? value.getTime() : value;
  }
  function readGraphic(fromJSON, json) {
    const symbol = isRecord4(json.symbol) ? json.symbol : null;
    const popupTemplate = isRecord4(json.popupTemplate) ? json.popupTemplate : null;
    const constructorSymbol = symbol && typeof symbol.type === "string" && !symbol.type.startsWith("esri") && symbol.type !== "CIMSymbolReference";
    const constructorPopup = popupTemplate !== null && "content" in popupTemplate;
    if (!constructorSymbol && !constructorPopup) {
      return fromJSON(json);
    }
    const graphic = fromJSON({
      ...json,
      ...constructorSymbol ? { symbol: void 0 } : {},
      ...constructorPopup ? { popupTemplate: void 0 } : {}
    });
    if (constructorSymbol) {
      graphic.symbol = symbol;
    }
    if (constructorPopup) {
      graphic.popupTemplate = popupTemplate;
    }
    return graphic;
  }
  function collectSymbolTypes(renderer) {
    const types = [];
    const read = (value) => {
      if (!isRecord4(value)) {
        return;
      }
      if (typeof value.type === "string") {
        types.push(value.type);
      }
    };
    read(renderer.symbol);
    read(renderer.defaultSymbol);
    for (const key of ["uniqueValueInfos", "classBreakInfos"]) {
      const infos = renderer[key];
      if (Array.isArray(infos)) {
        for (const info of infos) {
          read(isRecord4(info) ? info.symbol : null);
        }
      }
    }
    return types;
  }

  // src/frame/layer-access.ts
  function readLayerSource(payload) {
    const source = payload.source;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("materialize-layer requires a source.");
    }
    const candidate = source;
    if (typeof candidate.url === "string" && candidate.url.trim()) {
      return { url: candidate.url.trim() };
    }
    if (typeof candidate.portalItemId === "string" && candidate.portalItemId.trim()) {
      const layerId = typeof candidate.layerId === "number" ? candidate.layerId : void 0;
      return {
        portalItemId: candidate.portalItemId.trim(),
        ...layerId !== void 0 ? { layerId } : {}
      };
    }
    throw new Error("materialize-layer source requires a url or portalItemId.");
  }
  function readOptionalLayerSource(document2) {
    const url = typeof document2.url === "string" ? document2.url.trim() : "";
    if (url) {
      return { url };
    }
    const itemId = typeof document2.itemId === "string" ? document2.itemId.trim() : "";
    if (itemId) {
      const layerId = typeof document2.layerId === "number" ? document2.layerId : void 0;
      return { portalItemId: itemId, ...layerId === void 0 ? {} : { layerId } };
    }
    return null;
  }
  function findLayerById(layers, layerId) {
    var _a, _b;
    for (const layer of layers) {
      if (layer.id === layerId) {
        return layer;
      }
      const nested = (_b = (_a = layer.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a);
      if (nested == null ? void 0 : nested.length) {
        const match = findLayerById(nested, layerId);
        if (match) {
          return match;
        }
      }
    }
    return null;
  }
  function flattenLayers(layers) {
    return layers.flatMap((layer) => {
      var _a, _b, _c;
      return [layer, ...flattenLayers((_c = (_b = (_a = layer.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [])];
    });
  }
  function toBasemapCatalogDescriptor(basemap) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const id = ((_b = (_a = basemap == null ? void 0 : basemap.portalItem) == null ? void 0 : _a.id) == null ? void 0 : _b.trim()) || ((_c = basemap == null ? void 0 : basemap.id) == null ? void 0 : _c.trim());
    if (!id) {
      return null;
    }
    const title = ((_d = basemap == null ? void 0 : basemap.title) == null ? void 0 : _d.trim()) || ((_f = (_e = basemap == null ? void 0 : basemap.portalItem) == null ? void 0 : _e.title) == null ? void 0 : _f.trim()) || id;
    const thumbnailUrl = ((_g = basemap == null ? void 0 : basemap.thumbnailUrl) == null ? void 0 : _g.trim()) || ((_i = (_h = basemap == null ? void 0 : basemap.portalItem) == null ? void 0 : _h.thumbnailUrl) == null ? void 0 : _i.trim());
    return { id, title, ...thumbnailUrl ? { thumbnailUrl } : {} };
  }
  async function loadResolvedBasemap(basemap, requestedId) {
    var _a;
    try {
      await ((_a = basemap.load) == null ? void 0 : _a.call(basemap));
    } catch (error) {
      throw new Error(
        `The basemap "${requestedId}" resolved but could not be loaded: ${error instanceof Error ? error.message : String(error)}. The app map was left as it was.`
      );
    }
    return basemap;
  }
  function removeLayerByIdFromMap(map, layerId) {
    var _a, _b, _c, _d;
    const rootLayers = (_c = (_b = (_a = map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
    const topLevelLayer = rootLayers.find((layer) => layer.id === layerId);
    if (topLevelLayer) {
      (_d = map.remove) == null ? void 0 : _d.call(map, topLevelLayer);
      return true;
    }
    return removeLayerFromNestedCollection(rootLayers, layerId);
  }
  function removeLayerFromNestedCollection(layers, layerId) {
    var _a, _b, _c, _d;
    for (const layer of layers) {
      const children = (_c = (_b = (_a = layer.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
      const child = children.find((candidate) => candidate.id === layerId);
      if (child) {
        if (!((_d = layer.layers) == null ? void 0 : _d.remove)) {
          throw new Error(
            `Layer "${layerId}" is nested, but its owning collection does not support removal.`
          );
        }
        layer.layers.remove(child);
        return true;
      }
      if (children.length > 0 && removeLayerFromNestedCollection(children, layerId)) {
        return true;
      }
    }
    return false;
  }

  // src/frame/markdown.ts
  var TABLE_DELIMITER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/u;
  var HEADING = /^(#{1,4})\s+(.+)$/u;
  var BULLET = /^\s*[-*+]\s+(.+)$/u;
  var ORDERED = /^\s*\d+[.)]\s+(.+)$/u;
  var INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/u;
  var SAFE_LINK = /^(?:https?:|mailto:)/iu;
  function renderMarkdown(source) {
    var _a, _b;
    const root = document.createElement("div");
    root.className = "app-md";
    const lines = normalizeNewlines(source).split(/\r?\n/u);
    let index = 0;
    let paragraph = null;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        paragraph = null;
        index += 1;
        continue;
      }
      const heading = HEADING.exec(line);
      if (heading) {
        paragraph = null;
        const node = document.createElement("h4");
        node.className = `app-md-heading app-md-h${heading[1].length}`;
        appendInline(node, heading[2].trim());
        root.appendChild(node);
        index += 1;
        continue;
      }
      if (line.includes("|") && TABLE_DELIMITER.test((_a = lines[index + 1]) != null ? _a : "")) {
        paragraph = null;
        const rows = [];
        let cursor = index + 2;
        while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
          rows.push(lines[cursor]);
          cursor += 1;
        }
        root.appendChild(renderTable(line, lines[index + 1], rows));
        index = cursor;
        continue;
      }
      const listMatch = (_b = BULLET.exec(line)) != null ? _b : ORDERED.exec(line);
      if (listMatch) {
        paragraph = null;
        const ordered = !BULLET.test(line);
        const list = document.createElement(ordered ? "ol" : "ul");
        list.className = "app-md-list";
        let cursor = index;
        while (cursor < lines.length) {
          const item = (ordered ? ORDERED : BULLET).exec(lines[cursor]);
          if (!item) {
            break;
          }
          const entry = document.createElement("li");
          appendInline(entry, item[1].trim());
          list.appendChild(entry);
          cursor += 1;
        }
        root.appendChild(list);
        index = cursor;
        continue;
      }
      if (paragraph) {
        paragraph.appendChild(document.createElement("br"));
      } else {
        paragraph = document.createElement("p");
        paragraph.className = "app-md-paragraph";
        root.appendChild(paragraph);
      }
      appendInline(paragraph, line.trim());
      index += 1;
    }
    return root;
  }
  function normalizeNewlines(source) {
    return !/\n/u.test(source) && /\\n/u.test(source) ? source.replace(/\\n/gu, "\n") : source;
  }
  function splitCells(line) {
    const trimmed = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
    return trimmed.split("|").map((cell) => cell.trim());
  }
  function renderTable(headerLine, delimiterLine, rowLines) {
    const aligns = splitCells(delimiterLine).map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      return left && right ? "center" : right ? "right" : left ? "left" : null;
    });
    const wrap = document.createElement("div");
    wrap.className = "app-md-table-wrap";
    const table = document.createElement("table");
    table.className = "app-block-table app-md-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    splitCells(headerLine).forEach((cell, column) => {
      var _a;
      const th = document.createElement("th");
      alignCell(th, (_a = aligns[column]) != null ? _a : null);
      appendInline(th, cell);
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    for (const rowLine of rowLines) {
      const row = document.createElement("tr");
      splitCells(rowLine).forEach((cell, column) => {
        var _a;
        const td = document.createElement("td");
        alignCell(td, (_a = aligns[column]) != null ? _a : null);
        appendInline(td, cell);
        row.appendChild(td);
      });
      body.appendChild(row);
    }
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }
  function alignCell(cell, align) {
    if (align) {
      cell.style.textAlign = align;
    }
  }
  function appendInline(parent, text) {
    let rest = text;
    while (rest) {
      const match = INLINE.exec(rest);
      if (!match) {
        parent.appendChild(document.createTextNode(rest));
        return;
      }
      if (match.index > 0) {
        parent.appendChild(document.createTextNode(rest.slice(0, match.index)));
      }
      parent.appendChild(inlineNode(match[0]));
      rest = rest.slice(match.index + match[0].length);
    }
  }
  function inlineNode(token) {
    if (token.startsWith("**") || token.startsWith("__")) {
      const node2 = document.createElement("strong");
      appendInline(node2, token.slice(2, -2));
      return node2;
    }
    if (token.startsWith("`")) {
      const node2 = document.createElement("code");
      node2.textContent = token.slice(1, -1);
      return node2;
    }
    if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      if (!SAFE_LINK.test(href)) {
        return document.createTextNode(label);
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      return link;
    }
    const node = document.createElement("em");
    appendInline(node, token.slice(1, -1));
    return node;
  }

  // src/frame/blocks.ts
  function element(name, className) {
    const node = document.createElement(name);
    if (className) {
      node.className = className;
    }
    return node;
  }
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgElement(name, className) {
    const node = document.createElementNS(SVG_NS, name);
    if (className) {
      node.setAttribute("class", className);
    }
    return node;
  }
  function blockCard(block) {
    const card = element("calcite-card", `app-block app-block-${block.type}`);
    card.setAttribute("data-block-id", block.id);
    return card;
  }
  function appendTitle(card, title, icon) {
    const heading = element("h3", "app-block-title");
    if (icon) {
      heading.appendChild(createIcon(icon));
    }
    const label = element("span", "app-block-title-text");
    label.textContent = title;
    heading.appendChild(label);
    card.appendChild(heading);
  }
  function createIcon(icon, scale = "s") {
    const node = element("calcite-icon", "app-icon");
    node.setAttribute("icon", icon);
    node.setAttribute("scale", scale);
    return node;
  }
  function appendDescription(card, description) {
    if (!description) {
      return;
    }
    const node = element("p", "app-block-description");
    node.textContent = description;
    card.appendChild(node);
  }
  var LIVE_SLOT_CLASS = "app-block-live";
  var LIVE_STATUS_CLASS = "app-block-live-status";
  function appendLiveSlot(card, block) {
    const slot = element("div", LIVE_SLOT_CLASS);
    slot.setAttribute("data-live-block", block.id);
    slot.setAttribute("data-state", "pending");
    card.appendChild(slot);
    const status = element("p", LIVE_STATUS_CLASS);
    status.textContent = "Reading…";
    card.appendChild(status);
  }
  function renderBlock(block) {
    const card = blockCard(block);
    switch (block.type) {
      case "text":
        card.classList.add("app-block-text");
        card.appendChild(
          block.format === "markdown" ? renderMarkdown(block.content) : document.createTextNode(block.content)
        );
        return card;
      case "kpi":
      case "stat":
      case "list":
      case "table":
      case "chart":
      case "trend":
      case "selector":
        appendTitle(card, block.title, block.icon);
        appendLiveSlot(card, block);
        appendDescription(
          card,
          block.type === "kpi" || block.type === "stat" ? block.description : void 0
        );
        return card;
      case "report":
        appendTitle(card, block.title, block.icon);
        card.appendChild(renderMarkdown(block.content));
        return card;
      case "customMount": {
        card.removeAttribute("data-block-id");
        if (block.title) {
          appendTitle(card, block.title, block.icon);
        }
        const mount = element("div", "app-code-mount");
        mount.id = `app-mount-${block.id}`;
        mount.setAttribute("data-app-mount", block.id);
        mount.setAttribute("data-block-id", block.id);
        card.appendChild(mount);
        return card;
      }
    }
  }
  function motionAllowed() {
    return typeof window.matchMedia === "function" && typeof window.requestAnimationFrame === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function nextFrame(apply) {
    if (motionAllowed()) {
      window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
    } else {
      apply();
    }
  }
  function formatNumber(value) {
    if (Math.abs(value) >= 1e6) {
      return new Intl.NumberFormat(void 0, {
        notation: "compact",
        maximumFractionDigits: 1
      }).format(value);
    }
    return new Intl.NumberFormat(void 0, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : Math.abs(value) < 10 ? 2 : 1
    }).format(value);
  }
  function countTo(node, value) {
    const previous = Number(node.dataset.value);
    node.dataset.value = String(value);
    node.textContent = formatNumber(value);
    if (!motionAllowed() || !Number.isFinite(previous) || previous === value) {
      return;
    }
    const started = performance.now();
    const duration = 700;
    const step = (now) => {
      if (node.dataset.value !== String(value)) {
        return;
      }
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = formatNumber(
        progress < 1 ? roundLike(previous + (value - previous) * eased, value) : value
      );
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    node.textContent = formatNumber(previous);
    window.requestAnimationFrame(step);
  }
  function roundLike(value, target) {
    return Number.isInteger(target) ? Math.round(value) : value;
  }
  var GAUGE_RADIUS = 26;
  var GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
  function paintValue(slot, value, options = {}) {
    var _a;
    let number = slot.querySelector(".app-block-number");
    if (!number) {
      slot.replaceChildren();
      const row = element("div", "app-block-value-row");
      if (options.target !== void 0) {
        row.appendChild(buildGauge());
      }
      const text = element("div", "app-block-value-text");
      const valueNode = element("p", "app-block-value");
      number = element("span", "app-block-number");
      valueNode.appendChild(number);
      if (options.unit) {
        const unitNode = element("span", "app-block-unit");
        unitNode.textContent = options.unit;
        valueNode.appendChild(unitNode);
      }
      text.appendChild(valueNode);
      if (options.target !== void 0) {
        const targetNode = element("p", "app-block-trend");
        targetNode.textContent = `Target ${formatNumber(options.target)}`;
        text.appendChild(targetNode);
      }
      row.appendChild(text);
      slot.appendChild(row);
    }
    if (value === null) {
      delete number.dataset.value;
      number.textContent = "—";
    } else {
      countTo(number, value);
    }
    const arc = slot.querySelector(".app-gauge-arc");
    const percent = slot.querySelector(".app-gauge-percent");
    if (arc && percent && options.target !== void 0) {
      const ratio = value === null || options.target === 0 ? 0 : value / options.target;
      const clamped = Math.max(0, Math.min(1, ratio));
      (_a = slot.querySelector(".app-gauge")) == null ? void 0 : _a.setAttribute("data-met", String(ratio >= 1));
      percent.textContent = value === null ? "—" : `${Math.round(ratio * 100)}%`;
      nextFrame(
        () => arc.setAttribute("stroke-dashoffset", String(GAUGE_CIRCUMFERENCE * (1 - clamped)))
      );
    }
  }
  function buildGauge() {
    const gauge = element("div", "app-gauge");
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    const track = svgElement("circle", "app-gauge-track");
    const arc = svgElement("circle", "app-gauge-arc");
    for (const circle of [track, arc]) {
      circle.setAttribute("cx", "32");
      circle.setAttribute("cy", "32");
      circle.setAttribute("r", String(GAUGE_RADIUS));
    }
    arc.setAttribute("stroke-dasharray", String(GAUGE_CIRCUMFERENCE));
    arc.setAttribute("stroke-dashoffset", String(GAUGE_CIRCUMFERENCE));
    svg.append(track, arc);
    const percent = element("span", "app-gauge-percent");
    gauge.append(svg, percent);
    return gauge;
  }
  function paintList(slot, items) {
    slot.replaceChildren();
    const list = element("ul", "app-block-list");
    items.forEach((item, index) => {
      const entry = element("li", "app-block-list-item app-enter");
      entry.style.setProperty("--app-enter-index", String(index));
      const title = element("strong");
      title.textContent = item.title;
      entry.appendChild(title);
      if (item.subtitle) {
        const subtitle = element("span");
        subtitle.textContent = item.subtitle;
        entry.appendChild(subtitle);
      }
      list.appendChild(entry);
    });
    slot.appendChild(list);
  }
  function paintTable(slot, columns, rows) {
    slot.replaceChildren();
    const wrap = element("div", "app-md-table-wrap");
    const table = element("table", "app-block-table");
    const header = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const column of columns) {
      const cell = document.createElement("th");
      cell.textContent = column;
      headerRow.appendChild(cell);
    }
    header.appendChild(headerRow);
    table.appendChild(header);
    const body = document.createElement("tbody");
    rows.forEach((row, index) => {
      const rowNode = element("tr", "app-enter");
      rowNode.style.setProperty("--app-enter-index", String(index));
      for (const value of row) {
        const cell = document.createElement("td");
        cell.textContent = value;
        rowNode.appendChild(cell);
      }
      body.appendChild(rowNode);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    slot.appendChild(wrap);
  }
  var SERIES_COLORS = 8;
  function seriesColor(index, datum) {
    return datum.other ? "var(--app-series-other)" : `var(--app-series-${index % SERIES_COLORS + 1})`;
  }
  function paintChart(slot, series, options) {
    var _a;
    const kind = options.shape === "donut" ? "app-block-donut" : "app-block-chart";
    let chart = slot.querySelector(`:scope > .${kind}`);
    if (!chart) {
      slot.replaceChildren();
      chart = element("div", kind);
      slot.appendChild(chart);
    }
    chart.toggleAttribute("data-has-selection", options.selectedKey !== void 0);
    if (series.length === 0) {
      chart.replaceChildren(emptyNote());
      return;
    }
    (_a = chart.querySelector(":scope > .app-block-empty")) == null ? void 0 : _a.remove();
    if (options.shape === "donut") {
      paintDonut(chart, series, options);
    } else {
      paintBars(chart, series, options);
    }
  }
  function emptyNote() {
    const note = element("p", "app-block-empty");
    note.textContent = "No features match.";
    return note;
  }
  function datumButton(host, datum, className, options) {
    let node = host.querySelector(`:scope > [data-key="${cssEscape(datum.key)}"]`);
    const created = !node;
    if (!node) {
      node = element("button", className);
      node.setAttribute("type", "button");
      node.setAttribute("data-key", datum.key);
    }
    node.onclick = datum.other || !options.onSelect ? null : () => options.onSelect(datum);
    node.toggleAttribute("disabled", Boolean(datum.other) || !options.onSelect);
    node.setAttribute("aria-pressed", String(options.selectedKey === datum.key));
    node.toggleAttribute("data-selected", options.selectedKey === datum.key);
    node.title = `${datum.label}: ${formatNumber(datum.value)}`;
    return { node, created };
  }
  function paintBars(chart, series, options) {
    const maximum = Math.max(...series.map((entry) => entry.value), 1);
    const keep = /* @__PURE__ */ new Set();
    series.forEach((datum, index) => {
      const { node, created } = datumButton(chart, datum, "app-block-chart-row", options);
      if (created) {
        const label = element("span", "app-block-chart-label");
        const track = element("span", "app-block-chart-track");
        const bar2 = element("span", "app-block-chart-bar");
        bar2.style.width = "0%";
        track.appendChild(bar2);
        const value = element("span", "app-block-chart-value");
        node.append(label, track, value);
        node.classList.add("app-enter");
        node.style.setProperty("--app-enter-index", String(index));
      }
      node.querySelector(".app-block-chart-label").textContent = datum.label;
      countTo(node.querySelector(".app-block-chart-value"), datum.value);
      const bar = node.querySelector(".app-block-chart-bar");
      const width = `${Math.max(2, datum.value / maximum * 100)}%`;
      if (created) {
        nextFrame(() => {
          bar.style.width = width;
        });
      } else {
        bar.style.width = width;
      }
      chart.appendChild(node);
      keep.add(node);
    });
    [...chart.children].forEach((child) => {
      if (!keep.has(child)) {
        child.remove();
      }
    });
  }
  var DONUT_RADIUS = 100 / (2 * Math.PI);
  function paintDonut(chart, series, options) {
    let ring = chart.querySelector(":scope > .app-donut-figure svg");
    let legend = chart.querySelector(":scope > .app-donut-legend");
    let total = chart.querySelector(".app-donut-total");
    if (!ring || !legend || !total) {
      chart.replaceChildren();
      const figure = element("div", "app-donut-figure");
      ring = svgElement("svg");
      ring.setAttribute("viewBox", "0 0 42 42");
      ring.setAttribute("aria-hidden", "true");
      const track = svgElement("circle", "app-donut-track");
      setCircle(track);
      ring.appendChild(track);
      const center = element("div", "app-donut-center");
      total = element("span", "app-donut-total");
      const caption = element("span", "app-donut-caption");
      caption.textContent = "Total";
      center.append(total, caption);
      figure.append(ring, center);
      legend = element("div", "app-donut-legend");
      chart.append(figure, legend);
    }
    const sum = series.reduce((acc, datum) => acc + Math.max(0, datum.value), 0);
    countTo(total, sum);
    let offset = 0;
    const keepSlices = /* @__PURE__ */ new Set();
    const keepRows = /* @__PURE__ */ new Set();
    series.forEach((datum, index) => {
      const share = sum > 0 ? Math.max(0, datum.value) / sum * 100 : 0;
      const color = seriesColor(index, datum);
      let slice = ring.querySelector(`[data-key="${cssEscape(datum.key)}"]`);
      const created = !slice;
      if (!slice) {
        slice = svgElement("circle", "app-donut-slice");
        setCircle(slice);
        slice.setAttribute("data-key", datum.key);
        slice.setAttribute("stroke-dasharray", "0 100");
        slice.setAttribute("stroke-dashoffset", "25");
      }
      slice.style.stroke = color;
      slice.toggleAttribute("data-selected", options.selectedKey === datum.key);
      slice.toggleAttribute("data-selectable", !datum.other && Boolean(options.onSelect));
      slice.onclick = datum.other || !options.onSelect ? null : () => options.onSelect(datum);
      const length = share > 1.2 ? share - 0.6 : share;
      const dash = `${length} ${100 - length}`;
      const dashOffset = String(25 - offset);
      const apply = () => {
        slice.setAttribute("stroke-dasharray", dash);
        slice.setAttribute("stroke-dashoffset", dashOffset);
      };
      if (created) {
        nextFrame(apply);
      } else {
        apply();
      }
      ring.appendChild(slice);
      keepSlices.add(slice);
      offset += share;
      const { node, created: newRow } = datumButton(legend, datum, "app-donut-row", options);
      if (newRow) {
        node.append(
          element("span", "app-donut-swatch"),
          element("span", "app-donut-label"),
          element("span", "app-donut-share")
        );
        node.classList.add("app-enter");
        node.style.setProperty("--app-enter-index", String(index));
      }
      node.querySelector(".app-donut-swatch").style.background = color;
      node.querySelector(".app-donut-label").textContent = datum.label;
      node.querySelector(".app-donut-share").textContent = `${Math.round(share)}%`;
      legend.appendChild(node);
      keepRows.add(node);
    });
    ring.querySelectorAll(".app-donut-slice").forEach((slice) => {
      if (!keepSlices.has(slice)) {
        slice.remove();
      }
    });
    [...legend.children].forEach((row) => {
      if (!keepRows.has(row)) {
        row.remove();
      }
    });
  }
  function setCircle(circle) {
    circle.setAttribute("cx", "21");
    circle.setAttribute("cy", "21");
    circle.setAttribute("r", String(DONUT_RADIUS));
  }
  var TREND_WIDTH = 300;
  var TREND_HEIGHT = 90;
  function paintTrend(slot, points) {
    var _a, _b;
    let figure = slot.querySelector(":scope > .app-trend");
    if (!figure) {
      slot.replaceChildren();
      figure = buildTrend();
      slot.appendChild(figure);
    }
    if (points.length === 0) {
      figure.hidden = true;
      (_a = slot.querySelector(":scope > .app-block-empty")) == null ? void 0 : _a.remove();
      slot.appendChild(emptyNote());
      return;
    }
    figure.hidden = false;
    (_b = slot.querySelector(":scope > .app-block-empty")) == null ? void 0 : _b.remove();
    const latest = points[points.length - 1];
    const before = points.length > 1 ? points[points.length - 2] : null;
    countTo(figure.querySelector(".app-trend-latest"), latest.value);
    figure.querySelector(".app-trend-latest-label").textContent = latest.label;
    const delta = figure.querySelector(".app-trend-delta");
    if (before && before.value !== 0) {
      const change = (latest.value - before.value) / Math.abs(before.value) * 100;
      delta.hidden = false;
      delta.dataset.direction = change > 0.5 ? "up" : change < -0.5 ? "down" : "flat";
      delta.textContent = `${change > 0 ? "+" : ""}${Math.round(change)}%`;
      delta.title = `Change from ${before.label}`;
    } else {
      delta.hidden = true;
    }
    const maximum = Math.max(...points.map((point) => point.value), 0);
    const minimum = Math.min(...points.map((point) => point.value), 0);
    const span = maximum - minimum || 1;
    const coordinates = points.map((point, index) => ({
      x: points.length === 1 ? TREND_WIDTH / 2 : index / (points.length - 1) * TREND_WIDTH,
      y: TREND_HEIGHT - 6 - (point.value - minimum) / span * (TREND_HEIGHT - 12)
    }));
    const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const area = `${line} L${TREND_WIDTH} ${TREND_HEIGHT} L0 ${TREND_HEIGHT} Z`;
    const flat = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${TREND_HEIGHT}`).join(" ");
    const linePath = figure.querySelector(".app-trend-line");
    const areaPath = figure.querySelector(".app-trend-area");
    const previousCount = Number(linePath.dataset.count);
    linePath.dataset.count = String(points.length);
    if (previousCount !== points.length) {
      setPath(linePath, flat);
      setPath(areaPath, `${flat} L${TREND_WIDTH} ${TREND_HEIGHT} L0 ${TREND_HEIGHT} Z`);
    }
    nextFrame(() => {
      setPath(linePath, line);
      setPath(areaPath, area);
    });
    const hits = figure.querySelector(".app-trend-hits");
    hits.replaceChildren(
      ...points.map((point) => {
        const hit = element("span", "app-trend-hit");
        hit.title = `${point.label}: ${formatNumber(point.value)}`;
        return hit;
      })
    );
    const axis = figure.querySelector(".app-trend-axis");
    const labels = points.length > 2 ? [points[0].label, points[Math.floor((points.length - 1) / 2)].label, latest.label] : points.map((point) => point.label);
    axis.replaceChildren(
      ...labels.map((label) => {
        const node = element("span");
        node.textContent = label;
        return node;
      })
    );
  }
  function setPath(path, d) {
    path.setAttribute("d", d);
    path.style.setProperty("d", `path("${d}")`);
  }
  function buildTrend() {
    const figure = element("div", "app-trend");
    const head = element("div", "app-trend-head");
    const latest = element("span", "app-trend-latest app-block-value");
    const delta = element("span", "app-trend-delta");
    delta.hidden = true;
    const latestLabel = element("span", "app-trend-latest-label");
    head.append(latest, delta, latestLabel);
    const plot = element("div", "app-trend-plot");
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", `0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.append(svgElement("path", "app-trend-area"), svgElement("path", "app-trend-line"));
    const hits = element("div", "app-trend-hits");
    plot.append(svg, hits);
    const axis = element("div", "app-trend-axis");
    figure.append(head, plot, axis);
    return figure;
  }
  function cssEscape(value) {
    return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/["\\]/gu, "\\$&");
  }

  // src/frame/query.ts
  var STAT_FIELD = "nova_stat";
  function isQueryableLayer(layer) {
    const candidate = layer;
    return typeof (candidate == null ? void 0 : candidate.createQuery) === "function" && typeof candidate.queryFeatures === "function";
  }
  function baseQuery(layer, source, view) {
    const query = layer.createQuery();
    if (source.where) {
      query.where = source.where;
    }
    if (source.scope === "view" && (view == null ? void 0 : view.extent)) {
      query.geometry = view.extent;
      query.spatialRelationship = "intersects";
    }
    return query;
  }
  function readStatistic(attributes) {
    const value = attributes == null ? void 0 : attributes[STAT_FIELD];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  async function runStatistic(layer, source, statistic, field, view) {
    var _a, _b, _c, _d;
    const query = baseQuery(layer, source, view);
    if (statistic === "count") {
      return typeof layer.queryFeatureCount === "function" ? await layer.queryFeatureCount(query) : (_b = (_a = (await layer.queryFeatures(query)).features) == null ? void 0 : _a.length) != null ? _b : 0;
    }
    query.outStatistics = [
      {
        statisticType: statistic,
        onStatisticField: field,
        outStatisticFieldName: STAT_FIELD
      }
    ];
    query.returnGeometry = false;
    const result = await layer.queryFeatures(query);
    return readStatistic((_d = (_c = result.features) == null ? void 0 : _c[0]) == null ? void 0 : _d.attributes);
  }
  async function runGroupedStatistic(layer, source, groupBy, statistic, field, view) {
    var _a;
    const query = baseQuery(layer, source, view);
    query.outStatistics = [
      {
        statisticType: statistic,
        ...statistic === "count" ? {} : { onStatisticField: field },
        outStatisticFieldName: STAT_FIELD
      }
    ];
    if (statistic === "count") {
      query.outStatistics[0].onStatisticField = groupBy;
    }
    query.groupByFieldsForStatistics = [groupBy];
    query.orderByFields = [`${STAT_FIELD} DESC`];
    query.returnGeometry = false;
    const result = await layer.queryFeatures(query);
    return ((_a = result.features) != null ? _a : []).flatMap((feature) => {
      var _a2, _b;
      const value = readStatistic(feature.attributes);
      return value === null ? [] : [{ raw: (_b = (_a2 = feature.attributes) == null ? void 0 : _a2[groupBy]) != null ? _b : null, value }];
    });
  }
  async function runFeatures(layer, source, fields, orderBy, limit, view) {
    var _a;
    const query = baseQuery(layer, source, view);
    query.outFields = [...fields];
    query.returnGeometry = false;
    query.num = limit;
    if (orderBy) {
      query.orderByFields = [orderBy];
    }
    const result = await layer.queryFeatures(query);
    return ((_a = result.features) != null ? _a : []).slice(0, limit).map((feature) => {
      var _a2;
      return (_a2 = feature.attributes) != null ? _a2 : {};
    });
  }
  function formatLabel(value) {
    if (value === null || value === void 0 || value === "") {
      return "(none)";
    }
    return String(value);
  }
  function combineWhere(...clauses) {
    const present = clauses.filter((clause) => Boolean(clause && clause.trim()));
    if (present.length === 0) {
      return void 0;
    }
    return present.length === 1 ? present[0] : present.map((clause) => `(${clause})`).join(" AND ");
  }
  var FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/u;
  function sqlField(name) {
    if (!FIELD_NAME.test(name)) {
      throw new Error(`"${name}" is not a field name this app can filter on.`);
    }
    return name;
  }
  function sqlLiteral(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return `'${String(value).replace(/'/gu, "''")}'`;
  }
  function equalsClause(field, raw) {
    return raw === null || raw === void 0 ? `${sqlField(field)} IS NULL` : `${sqlField(field)} = ${sqlLiteral(raw)}`;
  }
  function readTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }
  function floorToInterval(time, interval) {
    const date = new Date(time);
    switch (interval) {
      case "hour":
        return Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours()
        );
      case "day":
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      case "week": {
        const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        return day - (date.getUTCDay() + 6) % 7 * 864e5;
      }
      case "month":
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
      case "year":
        return Date.UTC(date.getUTCFullYear(), 0, 1);
    }
  }
  function stepInterval(start, interval, count) {
    const date = new Date(start);
    switch (interval) {
      case "hour":
        return start + count * 36e5;
      case "day":
        return start + count * 864e5;
      case "week":
        return start + count * 7 * 864e5;
      case "month":
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1);
      case "year":
        return Date.UTC(date.getUTCFullYear() + count, 0, 1);
    }
  }
  function timestampLiteral(time) {
    return `TIMESTAMP '${new Date(time).toISOString().slice(0, 19).replace("T", " ")}'`;
  }
  async function runTrend(layer, source, dateField, interval, bins, statistic, field, view) {
    var _a, _b;
    const column = sqlField(dateField);
    const bounds = baseQuery(layer, source, view);
    bounds.outStatistics = [
      { statisticType: "min", onStatisticField: column, outStatisticFieldName: "nova_min" },
      { statisticType: "max", onStatisticField: column, outStatisticFieldName: "nova_max" }
    ];
    bounds.returnGeometry = false;
    const extremes = (_b = (_a = (await layer.queryFeatures(bounds)).features) == null ? void 0 : _a[0]) == null ? void 0 : _b.attributes;
    const latest = readTime(extremes == null ? void 0 : extremes.nova_max);
    const earliest = readTime(extremes == null ? void 0 : extremes.nova_min);
    if (latest === null) {
      return [];
    }
    const last = floorToInterval(latest, interval);
    const first = earliest === null ? last : floorToInterval(earliest, interval);
    const starts = [];
    for (let offset = bins - 1; offset >= 0; offset -= 1) {
      const start = stepInterval(last, interval, -offset);
      if (start >= first) {
        starts.push(start);
      }
    }
    return await Promise.all(
      starts.map(async (start) => {
        const where = combineWhere(
          source.where,
          `${column} >= ${timestampLiteral(start)} AND ${column} < ${timestampLiteral(stepInterval(start, interval, 1))}`
        );
        const value = await runStatistic(layer, { ...source, where }, statistic, field, view);
        return { start, value: value != null ? value : 0 };
      })
    );
  }
  async function runDistinctValues(layer, where, field, limit) {
    var _a;
    const query = layer.createQuery();
    if (where) {
      query.where = where;
    }
    query.outFields = [sqlField(field)];
    query.returnDistinctValues = true;
    query.returnGeometry = false;
    query.orderByFields = [field];
    query.num = limit;
    const result = await layer.queryFeatures(query);
    const values = ((_a = result.features) != null ? _a : []).map((feature) => {
      var _a2, _b;
      return (_b = (_a2 = feature.attributes) == null ? void 0 : _a2[field]) != null ? _b : null;
    });
    return [...new Set(values)].slice(0, limit);
  }
  async function runRange(layer, where, field) {
    var _a, _b;
    const query = layer.createQuery();
    if (where) {
      query.where = where;
    }
    query.outStatistics = [
      { statisticType: "min", onStatisticField: sqlField(field), outStatisticFieldName: "nova_min" },
      { statisticType: "max", onStatisticField: field, outStatisticFieldName: "nova_max" }
    ];
    query.returnGeometry = false;
    const attributes = (_b = (_a = (await layer.queryFeatures(query)).features) == null ? void 0 : _a[0]) == null ? void 0 : _b.attributes;
    const min = attributes == null ? void 0 : attributes.nova_min;
    const max = attributes == null ? void 0 : attributes.nova_max;
    return typeof min === "number" && typeof max === "number" ? { min, max } : null;
  }

  // src/frame/selectors.ts
  var ALL = "\0all";
  function paintChips(slot, label, options, onChange) {
    const group = document.createElement("calcite-chip-group");
    group.className = "app-selector-chips";
    group.setAttribute("label", label);
    group.setAttribute("selection-mode", "multiple");
    group.setAttribute("scale", "s");
    for (const option of options) {
      const chip = document.createElement("calcite-chip");
      chip.setAttribute("label", option.label);
      chip.setAttribute("kind", "neutral");
      chip.setAttribute("appearance", "outline-fill");
      chip.setAttribute("scale", "s");
      chip.value = option.key;
      chip.setAttribute("data-key", option.key);
      chip.textContent = option.label;
      group.appendChild(chip);
    }
    group.addEventListener("calciteChipGroupSelect", () => {
      var _a;
      onChange(((_a = group.selectedItems) != null ? _a : []).map((chip) => String(chip.value)));
    });
    slot.replaceChildren(group);
  }
  function paintDropdown(slot, label, options, onChange) {
    const select = document.createElement("calcite-select");
    select.className = "app-selector-select";
    select.setAttribute("label", label);
    select.setAttribute("scale", "s");
    const all = document.createElement("calcite-option");
    all.value = ALL;
    all.setAttribute("value", ALL);
    all.textContent = "All";
    select.appendChild(all);
    for (const option of options) {
      const node = document.createElement("calcite-option");
      node.value = option.key;
      node.setAttribute("value", option.key);
      node.textContent = option.label;
      select.appendChild(node);
    }
    select.addEventListener("calciteSelectChange", () => {
      var _a;
      const value = (_a = select.value) != null ? _a : ALL;
      onChange(value === ALL ? [] : [value]);
    });
    slot.replaceChildren(select);
  }
  function paintRange(slot, label, range, onChange) {
    const slider = document.createElement("calcite-slider");
    slider.className = "app-selector-range";
    slider.setAttribute("label", label);
    slider.setAttribute("label-handles", "");
    slider.setAttribute("scale", "s");
    const step = niceStep(range.max - range.min);
    slider.min = range.min;
    slider.max = range.max;
    slider.step = step;
    slider.minValue = range.min;
    slider.maxValue = range.max;
    slider.labelFormatter = (value) => formatNumber(value);
    slider.addEventListener("calciteSliderChange", () => {
      const min = Number(slider.minValue);
      const max = Number(slider.maxValue);
      onChange(min <= range.min && max >= range.max ? void 0 : { min, max });
    });
    slot.replaceChildren(slider);
  }
  function niceStep(span) {
    if (!(span > 0)) {
      return 1;
    }
    const raw = span / 100;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const normalized = raw / magnitude;
    return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  }

  // src/frame/live-blocks.ts
  var POLL_INTERVAL_MS = 6e4;
  var CHIP_LIMIT = 6;
  function isBoundBlock(block) {
    return block.type === "kpi" || block.type === "stat" || block.type === "list" || block.type === "table" || block.type === "chart" || block.type === "trend";
  }
  var AppLiveBlockController = class {
    constructor(resources, importModule, reportError2 = () => void 0, reportWatcherError = () => void 0) {
      this.resources = resources;
      this.importModule = importModule;
      this.reportError = reportError2;
      this.reportWatcherError = reportWatcherError;
      __publicField(this, "entries", /* @__PURE__ */ new Map());
      __publicField(this, "selectors", /* @__PURE__ */ new Map());
      /** layerId → owner block id → the clause that owner applies. */
      __publicField(this, "filters", /* @__PURE__ */ new Map());
      __publicField(this, "chartSelections", /* @__PURE__ */ new Map());
      /** Layers whose view currently carries a filter set here, so teardown can lift it. */
      __publicField(this, "filteredLayerIds", /* @__PURE__ */ new Set());
      __publicField(this, "stationaryHandle", null);
      __publicField(this, "pollTimer", null);
      __publicField(this, "bindingGeneration", 0);
      __publicField(this, "viewWatcherState", "not-needed");
      __publicField(this, "viewWatcherError");
    }
    /**
     * Rebinds every bound block currently in the document.
     *
     * Called after the regions are rendered and after any region edit, because a
     * region edit replaces its children: the previous entries point at nodes that
     * are no longer in the document. Filters go with them, since the controls
     * that set them were just redrawn unselected.
     */
    async bind(blocks) {
      var _a;
      this.teardown();
      const bindingGeneration = this.bindingGeneration;
      for (const block of blocks) {
        if (!isBoundBlock(block) && block.type !== "selector") {
          continue;
        }
        const slot = document.querySelector(
          `[data-live-block="${cssEscape2(block.id)}"]`
        );
        const status = (_a = slot == null ? void 0 : slot.parentElement) == null ? void 0 : _a.querySelector(`.${LIVE_STATUS_CLASS}`);
        if (!slot || !status || !slot.classList.contains(LIVE_SLOT_CLASS)) {
          continue;
        }
        if (block.type === "selector") {
          this.selectors.set(block.id, { block, slot, status, state: "pending" });
        } else {
          this.entries.set(block.id, { block, slot, status, generation: 0, painted: false });
        }
      }
      if (this.entries.size === 0 && this.selectors.size === 0) {
        return;
      }
      await Promise.all([
        this.refresh(),
        ...[...this.selectors.values()].map(
          async (entry) => await this.loadSelector(entry, bindingGeneration)
        )
      ]);
      this.watchView(bindingGeneration);
      this.startPolling();
    }
    teardown() {
      var _a, _b;
      this.bindingGeneration += 1;
      (_b = (_a = this.stationaryHandle) == null ? void 0 : _a.remove) == null ? void 0 : _b.call(_a);
      this.stationaryHandle = null;
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.entries.clear();
      this.selectors.clear();
      this.filters.clear();
      this.chartSelections.clear();
      for (const layerId of this.filteredLayerIds) {
        void this.applyViewFilter(layerId);
      }
      this.viewWatcherState = "not-needed";
      this.viewWatcherError = void 0;
    }
    /** Ids of the blocks currently bound, so `inspect_app` can report them. */
    diagnostics() {
      const bound = [...this.entries.values()].map((entry) => {
        var _a;
        return {
          id: entry.block.id,
          layerId: entry.block.source.layerId,
          scope: entry.block.source.scope,
          state: (_a = entry.slot.getAttribute("data-state")) != null ? _a : "pending",
          ...entry.lastReadAt ? { lastReadAt: entry.lastReadAt } : {},
          ...entry.block.source.scope === "view" ? {
            viewWatcher: this.viewWatcherState,
            ...this.viewWatcherError ? { watcherError: this.viewWatcherError } : {}
          } : {},
          ...entry.status.getAttribute("data-error") ? { error: entry.status.getAttribute("data-error") } : {}
        };
      });
      const selectors = [...this.selectors.values()].map((entry) => ({
        id: entry.block.id,
        layerId: entry.block.source.layerId,
        scope: "layer",
        state: entry.state,
        ...entry.error ? { error: entry.error } : {}
      }));
      return [...bound, ...selectors];
    }
    /** The filters the reader has set, so an inspection can tell a filtered number from a wrong one. */
    activeFilters() {
      return [...this.filters.entries()].flatMap(
        ([layerId, owners]) => [...owners.entries()].map(([ownerId, where]) => ({ layerId, ownerId, where }))
      );
    }
    async refresh(onlyViewScoped = false) {
      const due = [...this.entries.values()].filter(
        (entry) => !onlyViewScoped || entry.block.source.scope === "view"
      );
      await Promise.all(due.map(async (entry) => await this.recompute(entry)));
    }
    /** Sets or clears one owner's clause on a layer, then redraws what reads that layer. */
    async setFilter(layerId, ownerId, where) {
      var _a;
      const owners = (_a = this.filters.get(layerId)) != null ? _a : /* @__PURE__ */ new Map();
      if (where) {
        owners.set(ownerId, where);
      } else {
        owners.delete(ownerId);
      }
      if (owners.size > 0) {
        this.filters.set(layerId, owners);
      } else {
        this.filters.delete(layerId);
      }
      await Promise.all([
        this.applyViewFilter(layerId),
        ...[...this.entries.values()].filter((entry) => entry.block.source.layerId === layerId).map(async (entry) => await this.recompute(entry))
      ]);
    }
    /** Every clause on the layer except the reader's own. */
    filterWhere(layerId, exceptOwnerId) {
      const owners = this.filters.get(layerId);
      if (!owners) {
        return void 0;
      }
      return combineWhere(
        ...[...owners.entries()].filter(([ownerId]) => ownerId !== exceptOwnerId).map(([, where]) => where)
      );
    }
    effectiveSource(entry) {
      const where = combineWhere(
        entry.block.source.where,
        this.filterWhere(entry.block.source.layerId, entry.block.id)
      );
      return { ...entry.block.source, ...where ? { where } : {} };
    }
    /**
     * Draws only the matching features of a filtered layer.
     *
     * A layer view filter is display state of this view alone: the layer's definition expression, its
     * saved document and every other reader of the layer are untouched, which is what keeps a
     * reader's click from being written into the map.
     */
    async applyViewFilter(layerId) {
      var _a, _b;
      const where = this.filterWhere(layerId);
      try {
        const layer = this.resolveLayer(layerId);
        const layerView = await ((_b = (_a = this.resources.view).whenLayerView) == null ? void 0 : _b.call(_a, layer));
        if (!layerView) {
          return;
        }
        layerView.filter = where ? { where } : null;
        if (where) {
          this.filteredLayerIds.add(layerId);
        } else {
          this.filteredLayerIds.delete(layerId);
        }
      } catch (error) {
        this.reportError(`filter:${layerId}`, error);
      }
    }
    async recompute(entry) {
      const generation = entry.generation + 1;
      entry.generation = generation;
      try {
        const layer = this.resolveLayer(entry.block.source.layerId);
        await this.paint(entry, layer, generation);
        if (entry.generation !== generation) {
          return;
        }
        entry.painted = true;
        entry.lastReadAt = (/* @__PURE__ */ new Date()).toISOString();
        entry.slot.setAttribute("data-state", "live");
        entry.slot.toggleAttribute(
          "data-filtered",
          Boolean(this.filterWhere(entry.block.source.layerId, entry.block.id))
        );
        entry.status.removeAttribute("data-error");
        entry.status.textContent = `Read ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`;
      } catch (error) {
        if (entry.generation !== generation) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        entry.slot.setAttribute("data-state", entry.painted ? "stale" : "unavailable");
        entry.status.setAttribute("data-error", message);
        entry.status.textContent = entry.painted ? `Stale — ${message}` : `Unavailable — ${message}`;
        this.reportError(entry.block.id, error);
      }
    }
    resolveLayer(layerId) {
      var _a, _b, _c, _d, _e;
      const layer = (_e = (_b = (_a = this.resources.map).findLayerById) == null ? void 0 : _b.call(_a, layerId)) != null ? _e : (_d = (_c = this.resources.map.layers) == null ? void 0 : _c.toArray) == null ? void 0 : _d.call(_c).find((candidate) => candidate.id === layerId);
      if (!layer) {
        throw new Error(`The app map has no layer "${layerId}".`);
      }
      if (!isQueryableLayer(layer)) {
        throw new Error(
          `Layer "${layerId}" cannot answer a query. Bind to a feature layer; a tile, imagery, map-image or group layer has no addressable table.`
        );
      }
      return layer;
    }
    async paint(entry, layer, generation) {
      const { block } = entry;
      const source = this.effectiveSource(entry);
      const view = this.resources.view;
      if (block.type === "kpi" || block.type === "stat") {
        const value = await runStatistic(layer, source, block.statistic, block.field, view);
        if (entry.generation !== generation) {
          return;
        }
        paintValue(entry.slot, value, {
          ...block.type === "kpi" && block.unit ? { unit: block.unit } : {},
          ...block.type === "stat" && block.target !== void 0 ? { target: block.target } : {}
        });
        return;
      }
      if (block.type === "chart") {
        const rows2 = await runGroupedStatistic(
          layer,
          source,
          block.groupBy,
          block.statistic,
          block.field,
          view
        );
        if (entry.generation !== generation) {
          return;
        }
        const series = this.chartSeries(block, rows2);
        entry.rawByKey = new Map(rows2.map((row) => [groupKey(row.raw), row.raw]));
        const selectedKey = this.chartSelections.get(block.id);
        paintChart(entry.slot, series, {
          shape: block.shape,
          ...selectedKey !== void 0 ? { selectedKey } : {},
          onSelect: (datum) => void this.selectChartGroup(entry, datum)
        });
        return;
      }
      if (block.type === "trend") {
        const bins = await runTrend(
          layer,
          source,
          block.dateField,
          block.interval,
          block.bins,
          block.statistic,
          block.field,
          view
        );
        if (entry.generation !== generation) {
          return;
        }
        paintTrend(
          entry.slot,
          bins.map((bin) => ({ label: formatBin(bin.start, block.interval), value: bin.value }))
        );
        return;
      }
      if (block.type === "list") {
        const fields = [block.titleField, ...block.subtitleField ? [block.subtitleField] : []];
        const rows2 = await runFeatures(layer, source, fields, block.orderBy, block.limit, view);
        if (entry.generation !== generation) {
          return;
        }
        paintList(
          entry.slot,
          rows2.map((row) => ({
            title: formatLabel(row[block.titleField]),
            ...block.subtitleField ? { subtitle: formatLabel(row[block.subtitleField]) } : {}
          }))
        );
        return;
      }
      const names = block.fields.map((field) => field.name);
      const rows = await runFeatures(layer, source, names, block.orderBy, block.limit, view);
      if (entry.generation !== generation) {
        return;
      }
      paintTable(
        entry.slot,
        block.fields.map((field) => {
          var _a;
          return (_a = field.label) != null ? _a : field.name;
        }),
        rows.map((row) => names.map((name) => formatLabel(row[name])))
      );
    }
    /**
     * The groups a chart draws. A donut of a count or a sum folds the groups past its limit into one
     * slice, so the ring still adds up to the whole; any other chart, and any other statistic, shows
     * its leading groups, because an average of the remainder is not a share of anything.
     */
    chartSeries(block, rows) {
      const toDatum = (row) => {
        var _a, _b;
        return {
          key: groupKey(row.raw),
          label: (_b = (_a = block.labels) == null ? void 0 : _a[String(row.raw)]) != null ? _b : formatLabel(row.raw),
          value: row.value
        };
      };
      const folds = block.shape === "donut" && (block.statistic === "count" || block.statistic === "sum") && rows.length > block.limit;
      if (!folds) {
        return rows.slice(0, block.limit).map(toDatum);
      }
      const head = rows.slice(0, Math.max(1, block.limit - 1)).map(toDatum);
      const rest = rows.slice(head.length).reduce((sum, row) => sum + row.value, 0);
      return [...head, { key: "\0other", label: "Other", value: rest, other: true }];
    }
    /** A click on the selected group clears it; a click on any other group filters to that one. */
    async selectChartGroup(entry, datum) {
      var _a;
      if (entry.block.type !== "chart" || !((_a = entry.rawByKey) == null ? void 0 : _a.has(datum.key))) {
        return;
      }
      const { block } = entry;
      const clear = this.chartSelections.get(block.id) === datum.key;
      if (clear) {
        this.chartSelections.delete(block.id);
      } else {
        this.chartSelections.set(block.id, datum.key);
      }
      await this.setFilter(
        block.source.layerId,
        block.id,
        clear ? void 0 : equalsClause(block.groupBy, entry.rawByKey.get(datum.key))
      );
    }
    async loadSelector(entry, bindingGeneration) {
      var _a, _b, _c, _d;
      const { block } = entry;
      try {
        const layer = this.resolveLayer(block.source.layerId);
        const field = sqlField(block.field);
        const fieldType = (_c = (_b = (_a = layer.fields) == null ? void 0 : _a.find((candidate) => candidate.name === field)) == null ? void 0 : _b.type) != null ? _c : "";
        if (/date/iu.test(fieldType)) {
          throw new Error(
            `"${field}" is a date field; filter on time with a trend block or a behavior.`
          );
        }
        const numeric = /integer|double|single|long|number/iu.test(fieldType);
        if (block.control === "range" || !block.control && numeric) {
          const range = await runRange(layer, block.source.where, field);
          if (bindingGeneration !== this.bindingGeneration) {
            return;
          }
          if (!range) {
            throw new Error(`"${field}" has no numeric values to range over.`);
          }
          entry.control = "range";
          paintRange(entry.slot, block.title, range, (value) => {
            void this.setFilter(
              block.source.layerId,
              block.id,
              value ? `${field} >= ${value.min} AND ${field} <= ${value.max}` : void 0
            );
          });
        } else {
          const values = await runDistinctValues(layer, block.source.where, field, block.limit);
          if (bindingGeneration !== this.bindingGeneration) {
            return;
          }
          const rawByKey = new Map(values.map((value) => [groupKey(value), value]));
          const options = values.map((value) => ({
            key: groupKey(value),
            label: formatLabel(value)
          }));
          const onChange = (keys) => {
            const clauses = keys.filter((key) => rawByKey.has(key)).map((key) => equalsClause(field, rawByKey.get(key)));
            void this.setFilter(
              block.source.layerId,
              block.id,
              clauses.length === 0 ? void 0 : clauses.length === 1 ? clauses[0] : clauses.map((clause) => `(${clause})`).join(" OR ")
            );
          };
          entry.control = (_d = block.control) != null ? _d : options.length <= CHIP_LIMIT ? "chips" : "dropdown";
          if (entry.control === "chips") {
            paintChips(entry.slot, block.title, options, onChange);
          } else {
            paintDropdown(entry.slot, block.title, options, onChange);
          }
        }
        entry.state = "live";
        entry.slot.setAttribute("data-state", "live");
        entry.status.removeAttribute("data-error");
        entry.status.textContent = `Read ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`;
      } catch (error) {
        if (bindingGeneration !== this.bindingGeneration) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        entry.state = "unavailable";
        entry.error = message;
        entry.slot.setAttribute("data-state", "unavailable");
        entry.status.setAttribute("data-error", message);
        entry.status.textContent = `Unavailable — ${message}`;
        this.reportError(block.id, error);
      }
    }
    watchView(bindingGeneration) {
      if (![...this.entries.values()].some((entry) => entry.block.source.scope === "view")) {
        return;
      }
      this.viewWatcherState = "loading";
      void this.importModule("esri/core/reactiveUtils").then((module) => {
        if (bindingGeneration !== this.bindingGeneration) {
          return;
        }
        const when = module.when;
        if (typeof when !== "function") {
          this.reportViewWatcherFailure(new Error("ArcGIS reactiveUtils.when is unavailable."));
          return;
        }
        this.stationaryHandle = when(
          () => this.resources.view.stationary === true,
          () => void this.refresh(true)
        );
        this.viewWatcherState = "active";
      }).catch((error) => {
        if (bindingGeneration === this.bindingGeneration) {
          this.reportViewWatcherFailure(error);
        }
      });
    }
    reportViewWatcherFailure(error) {
      const message = error instanceof Error ? error.message : String(error);
      this.viewWatcherState = "failed";
      this.viewWatcherError = message;
      this.reportWatcherError(error);
    }
    startPolling() {
      if (![...this.entries.values()].some((entry) => entry.block.autoPoll)) {
        return;
      }
      this.pollTimer = setInterval(() => {
        void Promise.all(
          [...this.entries.values()].filter((entry) => entry.block.autoPoll).map(async (entry) => await this.recompute(entry))
        );
      }, POLL_INTERVAL_MS);
    }
  };
  function groupKey(raw) {
    return raw === null || raw === void 0 ? "\0null" : String(raw);
  }
  var BIN_FORMATS = {
    hour: { month: "short", day: "numeric", hour: "numeric" },
    day: { month: "short", day: "numeric" },
    week: { month: "short", day: "numeric" },
    month: { month: "short", year: "numeric" },
    year: { year: "numeric" }
  };
  function formatBin(start, interval) {
    return new Intl.DateTimeFormat(void 0, { ...BIN_FORMATS[interval], timeZone: "UTC" }).format(
      start
    );
  }
  function cssEscape2(value) {
    return value.replace(/["\\]/gu, "\\$&");
  }

  // src/frame/log.ts
  var LOG = "[nova-app]";
  function describe(detail) {
    if (detail === void 0) {
      return "";
    }
    try {
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  function reportError(step, error) {
    const source = error != null ? error : {};
    const message = source.message ? source.message : String(error);
    const name = source.name ? source.name : "Error";
    const details = source.details ? describe(source.details) : "";
    try {
      console.error(
        LOG + " " + step + " :: " + name + ": " + message + (details ? " :: " + details : "")
      );
    } catch {
    }
  }

  // src/frame/map-capture.ts
  function immutableJsonSnapshot(value) {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
  }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    return Object.freeze(value);
  }
  function withoutOperationalLayers(document2, layerIds) {
    if (!isRecord4(document2) || layerIds.size === 0 || !Array.isArray(document2.operationalLayers)) {
      return document2;
    }
    return {
      ...document2,
      operationalLayers: document2.operationalLayers.filter(
        (layer) => !(isRecord4(layer) && typeof layer.id === "string" && layerIds.has(layer.id))
      )
    };
  }
  function collectLayerIds(layers, ids = /* @__PURE__ */ new Set()) {
    layers.forEach((layer) => {
      var _a, _b;
      if (layer.id) {
        ids.add(layer.id);
      }
      const children = (_b = (_a = layer.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a);
      if (children) {
        collectLayerIds(children, ids);
      }
    });
    return ids;
  }
  function mergeCapturedDisplayProperties(document2, liveLayers) {
    var _a, _b, _c, _d;
    const documentLayers = flattenCapturedOperationalLayers(document2.operationalLayers);
    for (const liveLayer of liveLayers) {
      const target = (_a = liveLayer.id ? documentLayers.find((layer) => layer.id === liveLayer.id) : void 0) != null ? _a : liveLayer.title ? documentLayers.find((layer) => layer.title === liveLayer.title) : void 0;
      if (!target) {
        continue;
      }
      if (liveLayer.effect !== void 0 && liveLayer.effect !== null) {
        target.effect = serializeValue(liveLayer.effect);
      }
      if (typeof liveLayer.blendMode === "string" && liveLayer.blendMode) {
        target.blendMode = liveLayer.blendMode;
      }
      overlayLiveFeatureCollectionDisplay(target, liveLayer);
      const children = (_d = (_c = (_b = liveLayer.layers) == null ? void 0 : _b.toArray) == null ? void 0 : _c.call(_b)) != null ? _d : [];
      if (children.length > 0) {
        mergeCapturedDisplayProperties({ operationalLayers: target.layers }, children);
      }
    }
    return document2;
  }
  function describeUncapturedLiveContent(document2, liveLayers, omittedLayerIds, view) {
    const capturedIds = new Set(
      flattenCapturedOperationalLayers(document2.operationalLayers).map((layer) => layer.id).filter((id) => typeof id === "string")
    );
    const warnings = [];
    const visit = (layers) => {
      var _a, _b, _c, _d;
      for (const layer of layers) {
        if (!layer.id || omittedLayerIds.has(layer.id)) {
          continue;
        }
        if (!capturedIds.has(layer.id)) {
          warnings.push(
            `Layer "${layer.title || layer.id}" (${(_a = layer.type) != null ? _a : "unknown type"}) is on the live map but the saved document cannot hold it, so it is gone when the output is reopened.`
          );
          continue;
        }
        visit((_d = (_c = (_b = layer.layers) == null ? void 0 : _b.toArray) == null ? void 0 : _c.call(_b)) != null ? _d : []);
      }
    };
    visit(liveLayers);
    const graphicCount = collectionSize(view.graphics);
    if (graphicCount > 0) {
      warnings.push(
        `${graphicCount} graphic${graphicCount === 1 ? "" : "s"} in view.graphics are not saved and are gone when the output is reopened.`
      );
    }
    const analysisCount = collectionSize(view.analyses);
    if (analysisCount > 0) {
      warnings.push(
        `${analysisCount} ${analysisCount === 1 ? "analysis" : "analyses"} in view.analyses are not saved. A Web Scene keeps a viewshed, line of sight or dimension only as a ViewshedLayer, LineOfSightLayer or DimensionLayer in map.layers.`
      );
    }
    return warnings;
  }
  function collectionSize(value) {
    const length = isRecord4(value) ? value.length : void 0;
    return typeof length === "number" ? length : 0;
  }
  function flattenCapturedOperationalLayers(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap(
      (layer) => isRecord4(layer) ? [layer, ...flattenCapturedOperationalLayers(layer.layers)] : []
    );
  }

  // src/agent/output/sdk-module-contract.ts
  function toAppEsmModuleId(moduleId) {
    return moduleId.startsWith("esri/") ? `@arcgis/core/${moduleId.slice("esri/".length)}.js` : moduleId;
  }
  function isSupportedAppArcgisModuleId(moduleId) {
    return /^esri\/[A-Za-z0-9_/-]+$/u.test(moduleId) || /^@arcgis\/core\/[A-Za-z0-9_/-]+\.js$/u.test(moduleId);
  }
  function isSensitiveAppArcgisModuleId(moduleId) {
    const esmModuleId = toAppEsmModuleId(moduleId);
    return esmModuleId === "@arcgis/core/config.js" || esmModuleId.startsWith("@arcgis/core/identity/");
  }

  // src/frame/modules.ts
  function loaderWindow() {
    return window;
  }
  function toEsmModuleId(moduleId) {
    return toAppEsmModuleId(moduleId);
  }
  function isSupportedArcgisModuleId(moduleId) {
    return isSupportedAppArcgisModuleId(moduleId);
  }
  function isSensitiveArcgisModuleId(moduleId) {
    return isSensitiveAppArcgisModuleId(moduleId);
  }
  function toLoadedModuleMap(moduleIds, modules) {
    const loaded = {};
    for (let index = 0; index < moduleIds.length; index += 1) {
      loaded[moduleIds[index]] = modules[index];
    }
    return loaded;
  }
  function loadArcgisModules(moduleIds, onLoad, onError) {
    let attempts = 0;
    function attempt() {
      if (typeof window === "undefined") {
        onError(new Error("The ArcGIS module loader requires a browser window."));
        return;
      }
      const host = loaderWindow();
      const captured = captureLoader(host);
      if (captured) {
        void captured.load(moduleIds).then((modules) => {
          removeAmbientEsmLoader(host);
          onLoad(toLoadedModuleMap(moduleIds, modules), captured.loadOne);
        }).catch(onError);
        return;
      }
      attempts += 1;
      if (attempts > 100) {
        onError(
          new Error("no ArcGIS module loader: neither window.require nor window.$arcgis appeared")
        );
        return;
      }
      setTimeout(attempt, 100);
    }
    attempt();
  }
  function captureLoader(host) {
    if (typeof host.require === "function") {
      const requireModules = host.require.bind(host);
      const load = async (moduleIds) => await new Promise((resolve, reject) => {
        requireModules(
          moduleIds.map(toAmdModuleId),
          (...modules) => resolve(modules),
          reject
        );
      });
      return {
        load,
        loadOne: async (moduleId) => (await load([moduleId]))[0]
      };
    }
    if (host.$arcgis && typeof host.$arcgis.import === "function") {
      const importModule = host.$arcgis.import.bind(host.$arcgis);
      const loadOne = async (moduleId) => await importModule(toEsmModuleId(moduleId));
      return {
        load: async (moduleIds) => await Promise.all(moduleIds.map(loadOne)),
        loadOne
      };
    }
    return null;
  }
  function toAmdModuleId(moduleId) {
    if (moduleId.startsWith("esri/")) {
      return moduleId;
    }
    return `esri/${toEsmModuleId(moduleId).slice("@arcgis/core/".length, -".js".length)}`;
  }
  function removeAmbientEsmLoader(host) {
    Reflect.deleteProperty(host, "$arcgis");
    if (host.$arcgis !== void 0) {
      try {
        Object.defineProperty(host, "$arcgis", {
          value: void 0,
          configurable: true,
          writable: true
        });
      } catch {
        Reflect.set(host, "$arcgis", void 0);
      }
    }
  }

  // src/frame/native-map-messages.ts
  var EN_US_MESSAGES = {
    actionsForLayer: "Actions for {title}",
    adjustBuffer: "Adjust buffer",
    arcgisBufferUnavailable: "ArcGIS buffer operations are unavailable in this app.",
    ask: "Ask",
    askNova: "Ask Nova about this",
    attachToChat: "Attach to chat",
    back: "Back",
    backToMapContents: "Back to map contents",
    backToSelectionActions: "Back to selection actions",
    basemap: "Basemap",
    basemapsLoadError: "Basemaps could not be loaded",
    buffer: "Buffer",
    bufferCreateError: "Buffer could not be created.",
    bufferDistance: "{distance} meter buffer",
    bufferMinimum: "Enter a distance of at least 25 meters.",
    bufferSelection: "Create a buffer",
    cancelBuffer: "Cancel buffer",
    clearAllLayers: "Clear all layers",
    closeSelectedFeatures: "Close selected features",
    closeSpatialSuggestions: "Close spatial suggestions",
    collapseLayer: "Collapse layer",
    copyLayerUrl: "Copy layer URL",
    darkGrayCanvas: "Dark Gray Canvas",
    details: "Details",
    distanceMeters: "Distance (meters)",
    enableTerrain: "Enable terrain",
    disableTerrain: "Disable terrain",
    expandLayer: "Expand layer",
    hideMapContents: "Hide map contents",
    imagery: "Imagery",
    keepBuffer: "Keep buffer",
    layers: "Layers",
    loadingLegend: "Loading legend",
    mapContents: "Map contents",
    mark: "Mark",
    markLocation: "Mark this location",
    markSaveUnconfirmed: "Mark save was not confirmed.",
    markedLocation: "Marked location {count}",
    moveDown: "Move down",
    moveUp: "Move up",
    navigation: "Navigation",
    next: "Next",
    noBasemaps: "No basemaps found",
    noLayers: "No layers",
    noMatchingLayers: "No matching layers",
    openBasemapPanel: "Open basemap panel",
    other: "Other",
    previous: "Previous",
    removeAllLayersConfirmation: "Remove all layers from this map?",
    removeLayer: "Remove layer",
    searchBasemaps: "Search basemaps",
    searchLayers: "Search layers",
    savingMark: "Saving mark...",
    selectedFeature: "Selected feature",
    selectedFeatures: "Selected features",
    selectionActions: "Selection actions",
    selectionBuffer: "Selection buffer",
    selectionBufferTitle: "{distance} m selection buffer",
    selectionGeometryError: "The selected geometry could not be converted into a buffer polygon.",
    showFeaturePosition: "{current} of {total}",
    suggest: "Suggest",
    suggestRelevantActions: "Suggest relevant actions",
    thinking: "Thinking",
    toggleLayerVisibility: "Toggle {title} visibility",
    topographic: "Topographic",
    terrain: "Terrain",
    untitledLayer: "Untitled layer",
    viewDetails: "View details",
    zoomToLayer: "Zoom to layer",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetCompass: "Reset compass"
  };
  var CATALOG = {
    "en-US": EN_US_MESSAGES
  };
  function nativeMapText(key, parameters = {}) {
    var _a, _b;
    const locale = document.documentElement.lang || "en-US";
    const messages = (_b = (_a = CATALOG[locale]) != null ? _a : CATALOG[locale.split("-", 1)[0]]) != null ? _b : EN_US_MESSAGES;
    return messages[key].replace(
      /\{(\w+)\}/gu,
      (_match, name) => {
        var _a2;
        return String((_a2 = parameters[name]) != null ? _a2 : "");
      }
    );
  }

  // src/frame/shells/native-control-assets.ts
  var NATIVE_CONTROL_ASSET_ROOT = "./assets/native-controls";
  function nativeControlAssetUrl(path) {
    return `${NATIVE_CONTROL_ASSET_ROOT}/${path}`;
  }

  // src/frame/native-map-controls.ts
  var selectionMenuBackground = nativeControlAssetUrl("circular-menu/menu-bg.png");
  var selectionMenuBackgroundLine = nativeControlAssetUrl("circular-menu/menu-bg-line.png");
  var selectionAskIcon = nativeControlAssetUrl("circular-menu/Ask.svg");
  var selectionSuggestIcon = nativeControlAssetUrl("circular-menu/Suggest.svg");
  var selectionSuggestHoverBackground = nativeControlAssetUrl("circular-menu/suggest-hover-bg.png");
  var selectionSuggestThinkingBackground = nativeControlAssetUrl(
    "circular-menu/suggest-thinking-bg.png"
  );
  var tocEmptyLight = nativeControlAssetUrl("map-layers/toc-empty-light.png");
  var tocEmptyDark = nativeControlAssetUrl("map-layers/toc-empty-dark.png");
  var NATIVE_MAP_CONTENTS_HOST_ID = "app-native-map-contents-host";
  var SELECTION_DIAL_ACTION_OFFSETS = [
    { x: -65, y: -43 },
    { x: 8, y: -81 },
    { x: 76, y: -32 },
    { x: 58, y: 51 }
  ];
  var SELECTION_DIAL_ACTION_DIAMETER = 56;
  var DEFAULT_SELECTION_BUFFER_METERS = 500;
  var SELECTION_BUFFER_LAYER_ID = "__nova-app-selection-buffer__";
  var FALLBACK_BASEMAP_IDS = [
    ["satellite", "imagery", nativeControlAssetUrl("basemap-previews/imagery.png")],
    ["topo-vector", "topographic", nativeControlAssetUrl("basemap-previews/topographic.png")],
    [
      "streets-navigation-vector",
      "navigation",
      nativeControlAssetUrl("basemap-previews/navigation.png")
    ],
    ["dark-gray-vector", "darkGrayCanvas", nativeControlAssetUrl("basemap-previews/dark-gray.png")]
  ];
  var BASEMAP_PREVIEW_BY_ID = new Map([
    ...FALLBACK_BASEMAP_IDS.map(([id, , thumbnailUrl]) => [id, thumbnailUrl]),
    ["national-geographic", nativeControlAssetUrl("basemap-previews/national-geographic.png")]
  ]);
  function mountNativeMapContents(resources, options = {}) {
    var _a, _b, _c, _d, _e;
    const host = document.createElement("section");
    host.id = NATIVE_MAP_CONTENTS_HOST_ID;
    host.classList.add("app-native-map-contents-host");
    host.setAttribute("aria-label", nativeMapText("mapContents"));
    const contents = document.createElement("section");
    contents.id = "app-native-map-contents";
    contents.classList.add("app-native-map-contents");
    contents.setAttribute("aria-label", nativeMapText("mapContents"));
    const navigation = document.createElement("section");
    navigation.className = "app-native-map-navigation";
    navigation.setAttribute("aria-label", nativeMapText("layers"));
    const toggle = createIconButton("layers", nativeMapText("layers"));
    toggle.classList.add("app-native-map-toggle");
    toggle.setAttribute("aria-controls", contents.id);
    const zoom = document.createElement("arcgis-zoom");
    zoom.view = resources.view;
    zoom.layout = "vertical";
    const compass = document.createElement("arcgis-compass");
    compass.view = resources.view;
    const zoomControls = document.createElement("div");
    zoomControls.className = "app-native-map-zoom";
    const zoomIn = createIconButton("plus", nativeMapText("zoomIn"));
    zoomIn.classList.add("app-native-map-navigation-button", "app-native-map-zoom-in");
    zoomIn.addEventListener("click", () => {
      var _a2;
      return void ((_a2 = zoom.zoomIn) == null ? void 0 : _a2.call(zoom));
    });
    const zoomOut = createIconButton("minus", nativeMapText("zoomOut"));
    zoomOut.classList.add("app-native-map-navigation-button", "app-native-map-zoom-out");
    zoomOut.addEventListener("click", () => {
      var _a2;
      return void ((_a2 = zoom.zoomOut) == null ? void 0 : _a2.call(zoom));
    });
    zoomControls.append(zoomIn, zoomOut);
    const compassButton = createIconButton("compass-needle", nativeMapText("resetCompass"));
    compassButton.classList.add("app-native-map-navigation-button", "app-native-map-compass");
    compassButton.addEventListener("click", () => {
      var _a2;
      return void ((_a2 = compass.reset) == null ? void 0 : _a2.call(compass));
    });
    const compassIcon = compassButton.querySelector("calcite-icon");
    const syncCompassOrientation = () => {
      var _a2;
      const orientation = (_a2 = compass.orientation) == null ? void 0 : _a2.z;
      compassIcon == null ? void 0 : compassIcon.style.setProperty(
        "transform",
        `rotate(${typeof orientation === "number" ? orientation : 0}deg)`
      );
    };
    compass.addEventListener("arcgisPropertyChange", syncCompassOrientation);
    syncCompassOrientation();
    const navigationProxy = document.createElement("div");
    navigationProxy.className = "app-native-map-navigation-proxy";
    navigationProxy.setAttribute("aria-hidden", "true");
    navigationProxy.append(zoom, compass);
    navigation.append(toggle, zoomControls, compassButton, navigationProxy);
    const state = {
      collapsedLayers: /* @__PURE__ */ new Set(),
      legendLoadingLayers: /* @__PURE__ */ new Set(),
      legendSymbolsCache: /* @__PURE__ */ new WeakMap(),
      thumbnailRequests: /* @__PURE__ */ new Map(),
      thumbnailObjectUrls: /* @__PURE__ */ new Set(),
      query: "",
      basemapQuery: "",
      view: "toc",
      activeMenuLayer: null,
      draggedLayer: null,
      basemaps: [],
      basemapsLoading: false,
      basemapError: null,
      groundEnabled: hasGround(resources.map.ground),
      savedGround: (_a = resources.map.ground) != null ? _a : "world-elevation",
      disposed: false
    };
    const disposers = [];
    disposers.push(() => compass.removeEventListener("arcgisPropertyChange", syncCompassOrientation));
    const render = () => renderMapContents(contents, host, resources, state, render, options);
    render();
    host.append(contents, navigation);
    const setExpanded = (expanded) => {
      contents.hidden = !expanded;
      toggle.setAttribute("aria-expanded", String(expanded));
      host.toggleAttribute("data-expanded", expanded);
    };
    toggle.addEventListener("click", () => setExpanded(contents.hidden));
    host.addEventListener("app-map-contents-collapse", () => setExpanded(false));
    setExpanded(false);
    const viewContainer = document.getElementById("app-view");
    const mountedInViewUi = !viewContainer && typeof ((_b = resources.view.ui) == null ? void 0 : _b.add) === "function";
    if (mountedInViewUi) {
      resources.view.ui.add(host, (_c = options.slot) != null ? _c : "manual");
    } else {
      viewContainer == null ? void 0 : viewContainer.appendChild(host);
    }
    const collectionHandle = (_e = (_d = resources.map.layers) == null ? void 0 : _d.on) == null ? void 0 : _e.call(
      _d,
      "change",
      render
    );
    if (collectionHandle) {
      disposers.push(() => {
        var _a2;
        return (_a2 = collectionHandle.remove) == null ? void 0 : _a2.call(collectionHandle);
      });
    }
    let disposed = false;
    return {
      element: host,
      refresh: render,
      dispose: () => {
        var _a2, _b2;
        if (disposed) {
          return;
        }
        disposed = true;
        state.disposed = true;
        state.thumbnailObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        state.thumbnailObjectUrls.clear();
        disposers.forEach((dispose) => dispose());
        if (mountedInViewUi) {
          (_b2 = (_a2 = resources.view.ui) == null ? void 0 : _a2.remove) == null ? void 0 : _b2.call(_a2, host);
        }
        host.remove();
      }
    };
  }
  function renderMapContents(container, host, resources, state, render, options) {
    container.replaceChildren();
    const slider = document.createElement("div");
    slider.className = "app-native-map-contents-slider";
    slider.dataset.view = state.view;
    slider.append(
      renderTocPage(host, resources, state, render, options),
      renderBasemapPage(host, resources, state, render, options)
    );
    container.appendChild(slider);
  }
  function renderTocPage(host, resources, state, render, options) {
    const page = document.createElement("div");
    page.className = "app-native-map-page";
    page.dataset.panelView = "toc";
    page.appendChild(
      createPanelHeader(nativeMapText("layers"), () => {
        collapseMapContents(host);
      })
    );
    const body = document.createElement("div");
    body.className = "app-native-map-page-body";
    const basemap = readActiveBasemap(resources.map);
    const basemapButton = document.createElement("button");
    basemapButton.type = "button";
    basemapButton.className = "app-native-active-basemap";
    basemapButton.setAttribute("aria-label", nativeMapText("openBasemapPanel"));
    basemapButton.append(
      createBasemapPreview(basemap.thumbnailUrl, basemap.title, resources.moduleLoader, state),
      createLabeledIcon(basemap.title, "chevron-right")
    );
    basemapButton.addEventListener("click", () => {
      state.view = "basemap";
      state.activeMenuLayer = null;
      render();
      void ensureBasemapOptions(resources, state, render);
    });
    const layersHeading = document.createElement("div");
    layersHeading.className = "app-native-layer-heading";
    const layersLabel = document.createElement("span");
    layersLabel.textContent = nativeMapText("layers");
    const clearButton = createIconButton("trash", nativeMapText("clearAllLayers"));
    clearButton.disabled = readLayerCollection(resources.map).length === 0;
    clearButton.addEventListener("click", () => {
      var _a, _b, _c, _d;
      if (!((_a = globalThis.confirm) == null ? void 0 : _a.call(globalThis, nativeMapText("removeAllLayersConfirmation")))) {
        return;
      }
      for (const layer of readLayerCollection(resources.map)) {
        (_c = (_b = resources.map).remove) == null ? void 0 : _c.call(_b, layer);
      }
      (_d = options.onMapDocumentChange) == null ? void 0 : _d.call(options);
      render();
    });
    layersHeading.append(layersLabel, clearButton);
    const tree = document.createElement("div");
    tree.id = "app-native-layer-list";
    tree.className = "app-native-layer-tree";
    tree.setAttribute("role", "tree");
    const layers = readLayerCollection(resources.map).slice().reverse();
    const matchingLayers = layers.filter((layer) => layerMatchesQuery(layer, state.query));
    if (matchingLayers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "app-native-layer-empty";
      empty.dataset.tocEmptyState = "true";
      empty.setAttribute(
        "aria-label",
        state.query ? nativeMapText("noMatchingLayers") : nativeMapText("noLayers")
      );
      empty.setAttribute("role", "status");
      const lightImage = document.createElement("img");
      lightImage.alt = "";
      lightImage.className = "app-native-layer-empty-image app-native-layer-empty-image--light";
      lightImage.src = tocEmptyLight;
      const darkImage = document.createElement("img");
      darkImage.alt = "";
      darkImage.className = "app-native-layer-empty-image app-native-layer-empty-image--dark";
      darkImage.src = tocEmptyDark;
      empty.append(lightImage, darkImage);
      tree.appendChild(empty);
    } else {
      matchingLayers.forEach(
        (layer) => tree.appendChild(renderLayerNode(layer, 0, resources, state, render, options))
      );
    }
    const search = createSearch(nativeMapText("searchLayers"), state.query, (value) => {
      state.query = value;
      render();
      const input = containerQuery("#app-native-layer-search");
      input == null ? void 0 : input.focus();
      input == null ? void 0 : input.setSelectionRange(value.length, value.length);
    });
    search.id = "app-native-layer-search";
    body.append(basemapButton, layersHeading, tree, search.parentElement);
    page.appendChild(body);
    return page;
  }
  function renderLayerNode(layer, depth, resources, state, render, options) {
    var _a, _b, _c, _d, _e;
    const wrapper = document.createElement("div");
    wrapper.className = "app-native-layer-node";
    wrapper.dataset.layerId = (_a = layer.id) != null ? _a : "";
    const row = document.createElement("div");
    row.className = "app-native-layer-row";
    row.setAttribute("role", "treeitem");
    row.style.setProperty("--layer-depth", String(depth));
    row.draggable = true;
    const children = readChildLayers(layer);
    const legendSymbols = resolveCachedLegendSymbols(
      layer,
      ((_b = layer.title) == null ? void 0 : _b.trim()) || nativeMapText("untitledLayer"),
      state
    );
    const hasLegend = children.length === 0 && layer.legendEnabled !== false && (legendSymbols === void 0 || legendSymbols.length > 0);
    const hasExpandableContent = children.length > 0 || hasLegend;
    const collapsed = state.collapsedLayers.has(layer);
    const disclosure = createIconButton(
      collapsed ? "chevron-right" : "chevron-down",
      collapsed ? nativeMapText("expandLayer") : nativeMapText("collapseLayer")
    );
    disclosure.classList.add("app-native-layer-disclosure");
    disclosure.hidden = !hasExpandableContent;
    disclosure.addEventListener("click", () => {
      if (state.collapsedLayers.has(layer)) {
        state.collapsedLayers.delete(layer);
      } else {
        state.collapsedLayers.add(layer);
      }
      render();
    });
    const visibility = createIconButton(
      layer.visible === false ? "view-hide" : "view-visible",
      nativeMapText("toggleLayerVisibility", { title: (_c = layer.title) != null ? _c : nativeMapText("untitledLayer") })
    );
    visibility.classList.add("app-native-layer-visibility");
    visibility.addEventListener("click", () => {
      var _a2;
      layer.visible = layer.visible === false;
      (_a2 = options.onMapDocumentChange) == null ? void 0 : _a2.call(options);
      render();
    });
    const glyph = document.createElement("calcite-icon");
    glyph.setAttribute("icon", resolveLayerIcon(layer.type));
    glyph.setAttribute("scale", "s");
    glyph.className = "app-native-layer-glyph";
    const label = document.createElement("span");
    label.className = "app-native-layer-label";
    label.textContent = ((_d = layer.title) == null ? void 0 : _d.trim()) || nativeMapText("untitledLayer");
    label.title = label.textContent;
    const menuButton = createIconButton(
      "ellipsis",
      nativeMapText("actionsForLayer", {
        title: (_e = label.textContent) != null ? _e : nativeMapText("untitledLayer")
      })
    );
    menuButton.classList.add("app-native-layer-menu-trigger");
    menuButton.addEventListener("click", () => {
      state.activeMenuLayer = state.activeMenuLayer === layer ? null : layer;
      render();
    });
    row.append(disclosure, glyph, label, menuButton, visibility);
    row.addEventListener("dragstart", () => {
      state.draggedLayer = layer;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("is-drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drag-over"));
    row.addEventListener("dragend", () => {
      state.draggedLayer = null;
      row.classList.remove("is-dragging");
    });
    row.addEventListener("drop", (event) => {
      var _a2, _b2, _c2, _d2;
      event.preventDefault();
      const dragged = state.draggedLayer;
      state.draggedLayer = null;
      if (!dragged || dragged === layer) {
        return;
      }
      const collection = resolveLayerCollection(resources.map, layer);
      const targetIndex = (_b2 = (_a2 = collection == null ? void 0 : collection.indexOf) == null ? void 0 : _a2.call(collection, layer)) != null ? _b2 : -1;
      if (targetIndex >= 0) {
        (_c2 = collection == null ? void 0 : collection.reorder) == null ? void 0 : _c2.call(collection, dragged, targetIndex);
        (_d2 = options.onMapDocumentChange) == null ? void 0 : _d2.call(options);
        render();
      }
    });
    if (state.activeMenuLayer === layer) {
      row.appendChild(renderLayerMenu(layer, resources, state, render, options));
    }
    wrapper.appendChild(row);
    if (!collapsed) {
      if (hasLegend) {
        if (legendSymbols) {
          wrapper.appendChild(renderLayerLegend(layer, depth, legendSymbols, resources.moduleLoader));
        } else {
          wrapper.appendChild(renderLegendLoadingRow(depth));
          void ensureLayerLegend(layer, resources.moduleLoader, state, render);
        }
      }
      children.filter((child) => layerMatchesQuery(child, state.query)).slice().reverse().forEach(
        (child) => wrapper.appendChild(renderLayerNode(child, depth + 1, resources, state, render, options))
      );
    }
    return wrapper;
  }
  function renderLayerLegend(layer, depth, symbols, moduleLoader) {
    var _a;
    const legend = document.createElement("div");
    legend.className = "app-native-layer-legend";
    legend.dataset.layerLegendId = (_a = layer.id) != null ? _a : "";
    legend.style.setProperty("--layer-depth", String(depth));
    symbols.forEach((symbol) => {
      const row = document.createElement("div");
      row.className = "app-native-legend-row";
      const swatch = document.createElement("span");
      swatch.className = "app-native-legend-swatch";
      swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "app-native-legend-label";
      label.textContent = symbol.label;
      row.append(swatch, label);
      legend.appendChild(row);
      void renderLegendSwatch(swatch, symbol, moduleLoader);
    });
    return legend;
  }
  function renderLegendLoadingRow(depth) {
    const row = document.createElement("div");
    row.className = "app-native-legend-loading";
    row.style.setProperty("--layer-depth", String(depth));
    row.setAttribute("aria-label", nativeMapText("loadingLegend"));
    const loader = document.createElement("calcite-loader");
    loader.setAttribute("scale", "s");
    row.appendChild(loader);
    return row;
  }
  async function ensureLayerLegend(layer, moduleLoader, state, render) {
    var _a, _b;
    if (state.legendLoadingLayers.has(layer)) {
      return;
    }
    state.legendLoadingLayers.add(layer);
    try {
      await ((_a = layer.load) == null ? void 0 : _a.call(layer));
    } catch (error) {
      console.error("Failed to load layer legend.", error);
    } finally {
      cacheLegendSymbols(layer, ((_b = layer.title) == null ? void 0 : _b.trim()) || nativeMapText("untitledLayer"), state);
      state.legendLoadingLayers.delete(layer);
      render();
    }
  }
  function cacheLegendSymbols(layer, fallbackLabel, state) {
    const symbols = buildLegendSymbols(layer, fallbackLabel);
    state.legendSymbolsCache.set(layer, {
      fingerprint: createLegendSymbolIconsFingerprint(symbols)
    });
  }
  function resolveCachedLegendSymbols(layer, fallbackLabel, state) {
    const cached = state.legendSymbolsCache.get(layer);
    if (!cached) {
      return void 0;
    }
    const currentSymbols = buildLegendSymbols(layer, fallbackLabel);
    return createLegendSymbolIconsFingerprint(currentSymbols) === cached.fingerprint ? currentSymbols : void 0;
  }
  function createLegendSymbolIconsFingerprint(symbols) {
    return JSON.stringify(
      toLegendFingerprintValue(
        symbols.map(({ geometryType, symbol }) => ({ geometryType, symbol })),
        /* @__PURE__ */ new WeakSet()
      )
    );
  }
  function toLegendFingerprintValue(value, visited) {
    if (!value || typeof value !== "object") {
      return value;
    }
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      const normalized2 = value.map((entry) => toLegendFingerprintValue(entry, visited));
      visited.delete(value);
      return normalized2;
    }
    const serializable = value;
    if (typeof serializable.toJSON === "function") {
      try {
        const serialized = serializable.toJSON();
        if (serialized !== value) {
          const normalized2 = toLegendFingerprintValue(serialized, visited);
          visited.delete(value);
          return normalized2;
        }
      } catch {
      }
    }
    const normalized = Object.fromEntries(
      Object.entries(value).filter(([, entryValue]) => entryValue !== void 0 && typeof entryValue !== "function").sort(([left], [right]) => left.localeCompare(right)).map(([key, entryValue]) => [key, toLegendFingerprintValue(entryValue, visited)])
    );
    visited.delete(value);
    return normalized;
  }
  async function renderLegendSwatch(host, symbol, moduleLoader) {
    if (!moduleLoader) {
      return;
    }
    try {
      const symbolUtils = await moduleLoader("esri/symbols/support/symbolUtils");
      if (!host.isConnected || typeof symbolUtils.renderPreviewHTML !== "function") {
        return;
      }
      await symbolUtils.renderPreviewHTML(symbol.symbol, {
        node: host,
        ...!usesNativePointSymbolSize(symbol) ? { size: { width: 12, height: 12 } } : {},
        maxSize: 12
      });
    } catch (error) {
      console.error("Failed to render layer legend symbol.", error);
    }
  }
  function usesNativePointSymbolSize(symbol) {
    if (symbol.geometryType === "point" || symbol.geometryType === "multipoint") {
      return true;
    }
    const type = symbol.symbol.type;
    return type === "simple-marker" || type === "picture-marker" || type === "point-3d" || type === "web-style";
  }
  function buildLegendSymbols(layer, fallbackLabel) {
    if (!layer.renderer || typeof layer.renderer !== "object") {
      return [];
    }
    const renderer = layer.renderer;
    const rendererType = typeof renderer.type === "string" ? renderer.type : "simple";
    const classBreakEntries = readUnknownCollection(renderer.classBreakInfos);
    if (rendererType !== "unique-value" && classBreakEntries.length <= 1) {
      const continuousColorSymbols = buildContinuousColorLegendSymbols(
        layer,
        renderer,
        fallbackLabel
      );
      if (continuousColorSymbols.length > 0) {
        return continuousColorSymbols;
      }
    }
    if (rendererType === "unique-value") {
      return buildRendererInfoSymbols(layer, renderer.uniqueValueInfos, fallbackLabel, renderer);
    }
    if (rendererType === "class-breaks") {
      return buildRendererInfoSymbols(layer, renderer.classBreakInfos, fallbackLabel, renderer);
    }
    return buildLegendSymbol(layer, renderer.symbol, renderer.label, fallbackLabel, "simple");
  }
  function buildContinuousColorLegendSymbols(layer, renderer, fallbackLabel) {
    var _a, _b;
    const colorVariable = readUnknownCollection(renderer.visualVariables).find(
      (variable) => (variable == null ? void 0 : variable.type) === "color"
    );
    const stops = readUnknownCollection(colorVariable == null ? void 0 : colorVariable.stops);
    if (stops.length === 0) {
      return [];
    }
    const classBreakSymbols = readUnknownCollection(renderer.classBreakInfos);
    const baseSymbol = (_b = renderer.symbol) != null ? _b : (_a = classBreakSymbols[0]) == null ? void 0 : _a.symbol;
    return stops.flatMap(
      (stop, index) => buildLegendSymbol(
        layer,
        createColorStopSymbol(baseSymbol, stop.color),
        stop.label,
        typeof stop.value === "number" && Number.isFinite(stop.value) ? String(stop.value) : fallbackLabel,
        `color-stop-${index}`
      )
    );
  }
  function createColorStopSymbol(baseSymbol, color) {
    if (!baseSymbol || typeof baseSymbol !== "object") {
      return { color };
    }
    const typedSymbol = baseSymbol;
    const symbol = typeof typedSymbol.clone === "function" ? typedSymbol.clone() : { ...typedSymbol };
    symbol.color = color;
    return symbol;
  }
  function buildRendererInfoSymbols(layer, value, fallbackLabel, renderer) {
    const symbols = readUnknownCollection(value).flatMap((info, index) => {
      var _a;
      const rangeLabel = typeof info.minValue === "number" && typeof info.maxValue === "number" ? `${info.minValue} - ${info.maxValue}` : fallbackLabel;
      return buildLegendSymbol(
        layer,
        info.symbol,
        (_a = info.label) != null ? _a : info.value,
        rangeLabel,
        String(index)
      );
    });
    symbols.push(
      ...buildLegendSymbol(
        layer,
        renderer.defaultSymbol,
        renderer.defaultLabel,
        nativeMapText("other"),
        "default"
      )
    );
    return symbols;
  }
  function buildLegendSymbol(layer, symbol, label, fallbackLabel, suffix) {
    var _a;
    if (!symbol || typeof symbol !== "object") {
      return [];
    }
    return [
      {
        id: `${(_a = layer.id) != null ? _a : "layer"}-legend-${suffix}`,
        label: typeof label === "string" && label.trim() ? label.trim() : fallbackLabel,
        symbol,
        ...layer.geometryType ? { geometryType: layer.geometryType } : {}
      }
    ];
  }
  function readUnknownCollection(value) {
    if (Array.isArray(value)) {
      return value;
    }
    const collection = value;
    return typeof (collection == null ? void 0 : collection.toArray) === "function" ? collection.toArray() : [];
  }
  function renderLayerMenu(layer, resources, state, render, options) {
    const menu = document.createElement("div");
    menu.className = "app-native-layer-menu";
    menu.setAttribute("role", "menu");
    const actions = [
      ...options.onAttachLayer && layer.id ? [
        {
          icon: "attachment",
          label: nativeMapText("attachToChat"),
          run: () => {
            var _a, _b, _c;
            return (_c = options.onAttachLayer) == null ? void 0 : _c.call(options, {
              id: layer.id,
              title: ((_a = layer.title) == null ? void 0 : _a.trim()) || layer.id,
              type: ((_b = layer.type) == null ? void 0 : _b.trim()) || "unknown",
              visible: layer.visible !== false
            });
          }
        }
      ] : [],
      {
        icon: "magnifying-glass-plus",
        label: nativeMapText("zoomToLayer"),
        run: () => {
          var _a, _b;
          if (layer.fullExtent) {
            void ((_b = (_a = resources.view).goTo) == null ? void 0 : _b.call(_a, layer.fullExtent, { duration: 500 }));
          }
        }
      },
      {
        icon: "arrow-up",
        label: nativeMapText("moveUp"),
        run: () => {
          var _a;
          moveLayer(layer, 1, resources.map);
          (_a = options.onMapDocumentChange) == null ? void 0 : _a.call(options);
        }
      },
      {
        icon: "arrow-down",
        label: nativeMapText("moveDown"),
        run: () => {
          var _a;
          moveLayer(layer, -1, resources.map);
          (_a = options.onMapDocumentChange) == null ? void 0 : _a.call(options);
        }
      },
      {
        icon: "trash",
        label: nativeMapText("removeLayer"),
        run: () => {
          var _a;
          removeLayer(layer, resources.map);
          (_a = options.onMapDocumentChange) == null ? void 0 : _a.call(options);
        }
      }
    ];
    const layerUrl = resolveLayerUrl(layer);
    if (layerUrl) {
      actions.splice(1, 0, {
        icon: "copy",
        label: nativeMapText("copyLayerUrl"),
        run: () => {
          var _a, _b;
          return (_b = (_a = globalThis.navigator) == null ? void 0 : _a.clipboard) == null ? void 0 : _b.writeText(layerUrl);
        }
      });
    }
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.label === nativeMapText("removeLayer") ? "app-native-layer-menu-item is-danger" : "app-native-layer-menu-item";
      button.setAttribute("role", "menuitem");
      const icon = document.createElement("calcite-icon");
      icon.setAttribute("icon", action.icon);
      icon.setAttribute("scale", "s");
      const label = document.createElement("span");
      label.textContent = action.label;
      button.append(icon, label);
      button.addEventListener("click", () => {
        try {
          const result = action.run();
          if (result) {
            void result.catch((error) => console.error("Failed to copy layer URL.", error));
          }
        } catch (error) {
          console.error("Failed to run layer menu action.", error);
        }
        state.activeMenuLayer = null;
        render();
      });
      menu.appendChild(button);
    });
    return menu;
  }
  function resolveLayerUrl(layer) {
    var _a;
    const rawLayerUrl = layer.url;
    const rawPortalItemUrl = (_a = layer.portalItem) == null ? void 0 : _a.url;
    const layerUrl = typeof rawLayerUrl === "string" ? rawLayerUrl.trim() : "";
    const portalItemUrl = typeof rawPortalItemUrl === "string" ? rawPortalItemUrl.trim() : "";
    const url = layerUrl || portalItemUrl;
    return url ? withServiceLayerId(url, layer.layerId) : null;
  }
  function withServiceLayerId(url, layerId) {
    if (typeof layerId !== "number" || !Number.isInteger(layerId) || layerId < 0) {
      return url;
    }
    const base = url.replace(/\/+$/u, "");
    if (/\/(?:FeatureServer|MapServer)$/iu.test(base)) {
      return `${base}/${layerId}`;
    }
    if (/\/SceneServer$/iu.test(base)) {
      return `${base}/layers/${layerId}`;
    }
    return url;
  }
  function renderBasemapPage(host, resources, state, render, options) {
    var _a;
    const page = document.createElement("div");
    page.className = "app-native-map-page";
    page.dataset.panelView = "basemap";
    page.appendChild(
      createPanelHeader(
        nativeMapText("basemap"),
        () => {
          collapseMapContents(host);
        },
        () => {
          state.view = "toc";
          render();
        }
      )
    );
    const body = document.createElement("div");
    body.className = "app-native-basemap-body";
    if (resources.view.type === "3d") {
      const terrainRow = document.createElement("div");
      terrainRow.className = "app-native-terrain-row";
      const terrainLabel = document.createElement("span");
      terrainLabel.textContent = nativeMapText("terrain");
      const terrainSwitch = document.createElement("calcite-switch");
      terrainSwitch.id = "app-native-terrain-toggle";
      terrainSwitch.setAttribute(
        "aria-label",
        state.groundEnabled ? nativeMapText("disableTerrain") : nativeMapText("enableTerrain")
      );
      terrainSwitch.checked = state.groundEnabled;
      terrainSwitch.addEventListener("click", () => {
        var _a2, _b;
        if (state.groundEnabled) {
          state.savedGround = (_a2 = resources.map.ground) != null ? _a2 : state.savedGround;
          resources.map.ground = { layers: [] };
        } else {
          resources.map.ground = state.savedGround;
        }
        state.groundEnabled = !state.groundEnabled;
        (_b = options.onMapDocumentChange) == null ? void 0 : _b.call(options);
        render();
      });
      terrainRow.append(terrainLabel, terrainSwitch);
      body.appendChild(terrainRow);
    }
    const search = createSearch(nativeMapText("searchBasemaps"), state.basemapQuery, (value) => {
      state.basemapQuery = value;
      render();
      const input = containerQuery("#app-native-basemap-search");
      input == null ? void 0 : input.focus();
      input == null ? void 0 : input.setSelectionRange(value.length, value.length);
    });
    search.id = "app-native-basemap-search";
    body.appendChild(search.parentElement);
    const list = document.createElement("div");
    list.id = "app-native-basemap-list";
    list.className = "app-native-basemap-list";
    if (state.basemapsLoading) {
      for (let index = 0; index < 4; index += 1) {
        const skeleton = document.createElement("div");
        skeleton.className = "app-native-basemap-skeleton";
        skeleton.setAttribute("aria-hidden", "true");
        list.appendChild(skeleton);
      }
    } else {
      const query = state.basemapQuery.trim().toLowerCase();
      const matchingOptions = state.basemaps.filter(
        (option) => option.title.toLowerCase().includes(query)
      );
      matchingOptions.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "app-native-basemap-card";
        button.dataset.basemapId = option.id;
        button.append(
          createBasemapPreview(option.thumbnailUrl, option.title, resources.moduleLoader, state)
        );
        const label = document.createElement("span");
        label.textContent = option.title;
        button.appendChild(label);
        button.addEventListener("click", () => {
          var _a2;
          resources.map.basemap = option.basemap;
          (_a2 = options.onMapDocumentChange) == null ? void 0 : _a2.call(options);
          state.view = "toc";
          render();
        });
        list.appendChild(button);
      });
      if (matchingOptions.length === 0) {
        const empty = document.createElement("div");
        empty.className = "app-native-basemap-empty";
        empty.textContent = (_a = state.basemapError) != null ? _a : nativeMapText("noBasemaps");
        list.appendChild(empty);
      }
    }
    body.appendChild(list);
    page.appendChild(body);
    return page;
  }
  async function ensureBasemapOptions(resources, state, render) {
    if (state.basemapsLoading || state.basemaps.length > 0) {
      return;
    }
    state.basemapsLoading = true;
    state.basemapError = null;
    render();
    try {
      const active = resources.map.basemap;
      const gallery = await loadPortalBasemaps(resources);
      state.basemaps = dedupeBasemaps([...active ? [active] : [], ...gallery]);
    } catch {
      state.basemapError = nativeMapText("basemapsLoadError");
      state.basemaps = await loadFallbackBasemaps(resources);
    } finally {
      state.basemapsLoading = false;
      render();
    }
  }
  async function loadPortalBasemaps(resources) {
    var _a, _b;
    if (!resources.moduleLoader) {
      return [];
    }
    const Portal = await resources.moduleLoader("esri/portal/Portal");
    const portal = new Portal(resources.portalUrl ? { url: resources.portalUrl } : {});
    await ((_a = portal.load) == null ? void 0 : _a.call(portal));
    const basemaps = await ((_b = portal.fetchBasemaps) == null ? void 0 : _b.call(portal));
    await Promise.allSettled((basemaps != null ? basemaps : []).map(async (basemap) => {
      var _a2;
      return (_a2 = basemap.load) == null ? void 0 : _a2.call(basemap);
    }));
    return basemaps != null ? basemaps : [];
  }
  async function loadFallbackBasemaps(resources) {
    if (!resources.moduleLoader) {
      return [];
    }
    const Basemap = await resources.moduleLoader("esri/Basemap");
    return FALLBACK_BASEMAP_IDS.flatMap(([id, title, thumbnailUrl]) => {
      var _a, _b, _c, _d;
      const basemap = (_a = Basemap.fromId) == null ? void 0 : _a.call(Basemap, id);
      return basemap ? [
        {
          id,
          title: nativeMapText(title),
          thumbnailUrl: (_d = (_c = basemap.thumbnailUrl) != null ? _c : (_b = basemap.portalItem) == null ? void 0 : _b.thumbnailUrl) != null ? _d : thumbnailUrl,
          basemap
        }
      ] : [];
    });
  }
  function dedupeBasemaps(basemaps) {
    const options = /* @__PURE__ */ new Map();
    basemaps.forEach((basemap) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const id = (isBundledTopographicBasemap(basemap) ? "topo-vector" : "") || ((_a = basemap.id) == null ? void 0 : _a.trim()) || ((_c = (_b = basemap.portalItem) == null ? void 0 : _b.id) == null ? void 0 : _c.trim()) || "";
      if (!id || options.has(id.toLowerCase())) {
        return;
      }
      options.set(id.toLowerCase(), {
        id,
        title: ((_d = basemap.title) == null ? void 0 : _d.trim()) || ((_f = (_e = basemap.portalItem) == null ? void 0 : _e.title) == null ? void 0 : _f.trim()) || id,
        thumbnailUrl: (_i = (_h = basemap.thumbnailUrl) != null ? _h : (_g = basemap.portalItem) == null ? void 0 : _g.thumbnailUrl) != null ? _i : BASEMAP_PREVIEW_BY_ID.get(id),
        basemap
      });
    });
    return [...options.values()];
  }
  function readActiveBasemap(map) {
    var _a, _b, _c, _d, _e, _f, _g;
    const basemap = map.basemap;
    return {
      title: ((_a = basemap == null ? void 0 : basemap.title) == null ? void 0 : _a.trim()) || ((_c = (_b = basemap == null ? void 0 : basemap.portalItem) == null ? void 0 : _b.title) == null ? void 0 : _c.trim()) || nativeMapText("basemap"),
      thumbnailUrl: (_g = (_e = basemap == null ? void 0 : basemap.thumbnailUrl) != null ? _e : (_d = basemap == null ? void 0 : basemap.portalItem) == null ? void 0 : _d.thumbnailUrl) != null ? _g : basemap ? BASEMAP_PREVIEW_BY_ID.get(
        isBundledTopographicBasemap(basemap) ? "topo-vector" : (_f = basemap.id) != null ? _f : ""
      ) : void 0
    };
  }
  function isBundledTopographicBasemap(basemap) {
    var _a, _b, _c, _d, _e, _f;
    const id = (_a = basemap.id) == null ? void 0 : _a.trim();
    const portalItemId = (_c = (_b = basemap.portalItem) == null ? void 0 : _b.id) == null ? void 0 : _c.trim();
    if ((id == null ? void 0 : id.toLowerCase()) === "topo-vector") {
      return true;
    }
    const title = ((_d = basemap.title) == null ? void 0 : _d.trim()) || ((_f = (_e = basemap.portalItem) == null ? void 0 : _e.title) == null ? void 0 : _f.trim());
    return !portalItemId && !basemap.thumbnailUrl && (title == null ? void 0 : title.toLowerCase()) === "topographic";
  }
  function hasGround(ground) {
    if (!ground || typeof ground !== "object") {
      return typeof ground === "string" && ground.length > 0;
    }
    const layers = ground.layers;
    if (Array.isArray(layers)) {
      return layers.length > 0;
    }
    if (layers == null ? void 0 : layers.toArray) {
      return layers.toArray().length > 0;
    }
    return (layers == null ? void 0 : layers.length) !== 0;
  }
  function readLayerCollection(map) {
    var _a, _b, _c;
    return (_c = (_b = (_a = map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
  }
  function readChildLayers(layer) {
    var _a, _b, _c, _d, _e, _f;
    return (_f = (_e = (_b = (_a = layer.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _e : (_d = (_c = layer.sublayers) == null ? void 0 : _c.toArray) == null ? void 0 : _d.call(_c)) != null ? _f : [];
  }
  function layerMatchesQuery(layer, query) {
    var _a, _b;
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    return `${(_a = layer.title) != null ? _a : ""} ${(_b = layer.type) != null ? _b : ""}`.toLowerCase().includes(normalized) || readChildLayers(layer).some((child) => layerMatchesQuery(child, normalized));
  }
  function resolveLayerCollection(map, layer) {
    const rootCollection = map.layers;
    const findCollection = (collection) => {
      var _a, _b, _c, _d;
      if ((_a = collection == null ? void 0 : collection.toArray) == null ? void 0 : _a.call(collection).includes(layer)) {
        return collection;
      }
      for (const candidate of (_c = (_b = collection == null ? void 0 : collection.toArray) == null ? void 0 : _b.call(collection)) != null ? _c : []) {
        const match = findCollection(
          (_d = candidate.layers) != null ? _d : candidate.sublayers
        );
        if (match) {
          return match;
        }
      }
      return void 0;
    };
    return findCollection(rootCollection);
  }
  function moveLayer(layer, offset, map) {
    var _a, _b, _c, _d, _e;
    const collection = resolveLayerCollection(map, layer);
    const index = (_b = (_a = collection == null ? void 0 : collection.indexOf) == null ? void 0 : _a.call(collection, layer)) != null ? _b : -1;
    if (index < 0) {
      return;
    }
    const count = (_d = (_c = collection == null ? void 0 : collection.toArray) == null ? void 0 : _c.call(collection).length) != null ? _d : 0;
    (_e = collection == null ? void 0 : collection.reorder) == null ? void 0 : _e.call(collection, layer, Math.max(0, Math.min(count - 1, index + offset)));
  }
  function removeLayer(layer, map) {
    var _a, _b;
    const collection = resolveLayerCollection(map, layer);
    (_a = collection == null ? void 0 : collection.remove) == null ? void 0 : _a.call(collection, layer);
    if (collection === map.layers && !(collection == null ? void 0 : collection.remove)) {
      (_b = map.remove) == null ? void 0 : _b.call(map, layer);
    }
  }
  function resolveLayerIcon(type) {
    var _a;
    const normalized = (_a = type == null ? void 0 : type.toLowerCase()) != null ? _a : "";
    if (normalized.includes("group")) return "layers";
    if (normalized.includes("tile")) return "tile-layer";
    if (normalized.includes("imagery") || normalized.includes("map-image")) return "layer-basemap";
    if (normalized.includes("scene") || normalized.includes("elevation")) return "atmosphere";
    return "layer-points";
  }
  function createPanelHeader(title, onClose, onBack) {
    const header = document.createElement("header");
    header.className = "app-native-map-header";
    if (onBack) {
      const back = createIconButton("chevron-left", nativeMapText("backToMapContents"));
      back.addEventListener("click", onBack);
      header.appendChild(back);
    }
    const heading = document.createElement("h2");
    heading.textContent = title;
    header.appendChild(heading);
    const close = createIconButton("chevrons-right", nativeMapText("hideMapContents"));
    close.addEventListener("click", onClose);
    header.appendChild(close);
    return header;
  }
  function collapseMapContents(host) {
    host.dispatchEvent(new Event("app-map-contents-collapse"));
  }
  function createIconButton(iconName, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-native-icon-button";
    button.setAttribute("aria-label", label);
    button.title = label;
    const icon = document.createElement("calcite-icon");
    icon.setAttribute("icon", iconName);
    icon.setAttribute("scale", "s");
    button.appendChild(icon);
    return button;
  }
  function createLabeledIcon(labelText, iconName) {
    const content = document.createElement("span");
    content.className = "app-native-active-basemap-label";
    const label = document.createElement("span");
    label.textContent = labelText;
    const icon = document.createElement("calcite-icon");
    icon.setAttribute("icon", iconName);
    icon.setAttribute("scale", "s");
    content.append(label, icon);
    return content;
  }
  function createBasemapPreview(source, label, moduleLoader, state) {
    const frame = document.createElement("span");
    frame.className = "app-native-basemap-preview";
    if (source) {
      const image = document.createElement("img");
      image.alt = "";
      frame.appendChild(image);
      if (isRemoteImageSource(source) && moduleLoader) {
        void resolveAuthenticatedImageSource(source, moduleLoader, state).then((resolvedSource) => {
          if (!state.disposed) {
            image.src = resolvedSource;
          }
        });
      } else {
        image.src = source;
      }
    } else {
      const icon = document.createElement("calcite-icon");
      icon.setAttribute("icon", "basemap");
      icon.setAttribute("scale", "l");
      frame.appendChild(icon);
    }
    frame.title = label;
    return frame;
  }
  function isRemoteImageSource(source) {
    try {
      const protocol = new URL(source, window.location.href).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }
  function resolveAuthenticatedImageSource(source, moduleLoader, state) {
    const pending = state.thumbnailRequests.get(source);
    if (pending) {
      return pending;
    }
    const request = (async () => {
      try {
        const esriRequest = await moduleLoader("esri/request");
        const response = await esriRequest(source, { responseType: "blob" });
        const objectUrl = URL.createObjectURL(response.data);
        if (state.disposed) {
          URL.revokeObjectURL(objectUrl);
          return source;
        }
        state.thumbnailObjectUrls.add(objectUrl);
        return objectUrl;
      } catch {
        state.thumbnailRequests.delete(source);
        return source;
      }
    })();
    state.thumbnailRequests.set(source, request);
    return request;
  }
  function createSearch(placeholder, value, onInput) {
    const label = document.createElement("label");
    label.className = "app-native-map-search";
    const icon = document.createElement("calcite-icon");
    icon.setAttribute("icon", "search");
    icon.setAttribute("scale", "s");
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    input.value = value;
    input.addEventListener("input", () => onInput(input.value));
    label.append(icon, input);
    return input;
  }
  function containerQuery(selector) {
    return document.querySelector(selector);
  }
  function mountNativeSelectionDial(resources, options = {}) {
    var _a;
    const viewContainer = document.getElementById("app-view");
    const host = document.createElement("section");
    host.id = "app-native-selection-popup";
    host.classList.add("app-native-selection-popup");
    host.hidden = true;
    host.setAttribute("aria-label", nativeMapText("selectedFeatures"));
    const dial = document.createElement("section");
    dial.id = "app-native-selection-dial";
    dial.className = "geo-view-selection-dial";
    dial.hidden = true;
    dial.setAttribute("aria-label", nativeMapText("selectionActions"));
    dial.addEventListener("click", (event) => {
      var _a2;
      if (event.target === dial) {
        (_a2 = options.onSelectionPopupClose) == null ? void 0 : _a2.call(options);
      }
    });
    const mountedInViewUi = typeof ((_a = resources.view.ui) == null ? void 0 : _a.add) === "function";
    if (mountedInViewUi) {
      resources.view.ui.add(dial, "manual");
      resources.view.ui.add(host, "manual");
    } else {
      viewContainer == null ? void 0 : viewContainer.appendChild(dial);
      viewContainer == null ? void 0 : viewContainer.appendChild(host);
    }
    let features = [];
    let targetKind = "selection";
    let locationPoint;
    let activeFeatureIndex = 0;
    let selectionCount = 0;
    let anchor;
    let suggestionState = {
      status: "clear",
      selectionRevision: 0
    };
    let activeFeatureElement = null;
    let bufferLayer = null;
    let bufferRequest = 0;
    let popupResizeObserver = null;
    let markedLocationCount = 0;
    let markRequest = 0;
    let markSaving = false;
    let markStatus = "";
    let markedLocationGraphic = null;
    const GraphicsLayer = resources.modules["esri/layers/GraphicsLayer"];
    const Graphic = resources.modules["esri/Graphic"];
    const observePopupPlacement = () => {
      var _a2;
      popupResizeObserver == null ? void 0 : popupResizeObserver.disconnect();
      if (typeof ResizeObserver !== "function") {
        return;
      }
      popupResizeObserver = new ResizeObserver(() => {
        if (!host.hidden) {
          placeSelectionPopup(host, viewContainer, anchor);
        }
      });
      popupResizeObserver.observe((_a2 = host.querySelector("calcite-panel")) != null ? _a2 : host);
      if (viewContainer) {
        popupResizeObserver.observe(viewContainer);
      }
    };
    const clearBuffer = () => {
      var _a2, _b;
      bufferRequest += 1;
      if (bufferLayer) {
        (_b = (_a2 = resources.map).remove) == null ? void 0 : _b.call(_a2, bufferLayer);
        bufferLayer = null;
      }
    };
    const clearMark = () => {
      markRequest += 1;
      markSaving = false;
      markStatus = "";
      markedLocationGraphic = null;
    };
    const markLocation = () => {
      var _a2, _b, _c, _d;
      const point = locationPoint;
      if (targetKind !== "location" || !point || markSaving) {
        return;
      }
      if (!markedLocationGraphic) {
        markedLocationCount += 1;
      }
      const timestamp = Date.now();
      const graphicId = `marked-location-${timestamp}-${markedLocationCount}`;
      const title = nativeMapText("markedLocation", { count: markedLocationCount });
      const symbol = {
        type: "simple-marker",
        color: [249, 134, 49, 1],
        size: 10,
        outline: { color: [255, 255, 255, 1], width: 2 }
      };
      if (options.onPersistGraphic) {
        const geometry = toSerializableRecord(point);
        if (!geometry) {
          return;
        }
        markedLocationGraphic != null ? markedLocationGraphic : markedLocationGraphic = {
          graphicId,
          title,
          geometryType: "point",
          geometry,
          symbol,
          visible: true,
          origin: "ui",
          createdAt: timestamp,
          updatedAt: timestamp
        };
        const graphic = markedLocationGraphic;
        const request = ++markRequest;
        markSaving = true;
        markStatus = nativeMapText("savingMark");
        renderDial();
        void options.onPersistGraphic(graphic).then(
          () => {
            var _a3;
            if (disposed || request !== markRequest) {
              return;
            }
            markSaving = false;
            markStatus = "";
            renderDial();
            (_a3 = options.onSelectionPopupClose) == null ? void 0 : _a3.call(options);
          },
          () => {
            if (disposed || request !== markRequest) {
              return;
            }
            markSaving = false;
            markStatus = nativeMapText("markSaveUnconfirmed");
            renderDial();
          }
        );
        return;
      }
      if (!GraphicsLayer || !Graphic) {
        return;
      }
      const layer = new GraphicsLayer({
        id: graphicId,
        title,
        listMode: "show",
        graphics: [
          new Graphic({
            geometry: point,
            symbol
          })
        ]
      });
      (_b = (_a2 = resources.map).add) == null ? void 0 : _b.call(_a2, layer);
      (_c = options.onMapDocumentChange) == null ? void 0 : _c.call(options);
      (_d = options.onSelectionPopupClose) == null ? void 0 : _d.call(options);
    };
    const renderBuffer = () => {
      dial.hidden = true;
      host.replaceChildren();
      host.classList.add("app-native-buffer-popup");
      placeSelectionPopup(host, viewContainer, anchor);
      const panel = document.createElement("calcite-panel");
      panel.className = "app-native-buffer-panel";
      panel.setAttribute("heading", nativeMapText("adjustBuffer"));
      panel.setAttribute("scale", "m");
      const close = createIconButton("x", nativeMapText("cancelBuffer"));
      close.className = "geo-view-overlay-close-button";
      close.setAttribute("slot", "header-actions-end");
      close.addEventListener("click", () => {
        clearBuffer();
        host.hidden = true;
        renderDial();
      });
      const content = document.createElement("div");
      content.className = "app-native-buffer-content geo-view-selection-prompt__content";
      const label = document.createElement("calcite-label");
      label.className = "app-native-buffer-label geo-view-selection-dial__buffer-distance-label";
      label.textContent = nativeMapText("distanceMeters");
      const input = document.createElement("calcite-input");
      input.id = "app-native-buffer-distance";
      input.setAttribute("type", "number");
      input.setAttribute("min", "25");
      input.setAttribute("step", "25");
      input.setAttribute("scale", "s");
      input.value = String(DEFAULT_SELECTION_BUFFER_METERS);
      const status = document.createElement("p");
      status.id = "app-native-buffer-status";
      status.setAttribute("role", "status");
      status.hidden = true;
      const confirm = createSelectionButton(
        nativeMapText("keepBuffer"),
        "app-native-buffer-confirm",
        "brand"
      );
      confirm.setAttribute("appearance", "solid");
      confirm.toggleAttribute("disabled", true);
      const update = async () => {
        const distanceMeters = Number(input.value);
        if (!Number.isFinite(distanceMeters) || distanceMeters < 25) {
          status.textContent = nativeMapText("bufferMinimum");
          status.hidden = false;
          confirm.toggleAttribute("disabled", true);
          return;
        }
        status.hidden = true;
        confirm.toggleAttribute("disabled", true);
        const request = ++bufferRequest;
        try {
          const bufferFeatures = targetKind === "location" && locationPoint ? [{ geometry: locationPoint }] : features;
          await drawSelectionBuffer(
            resources,
            bufferFeatures,
            distanceMeters,
            request,
            () => bufferRequest,
            (layer) => {
              bufferLayer = layer;
            }
          );
          if (request === bufferRequest) {
            status.textContent = nativeMapText("bufferDistance", {
              distance: distanceMeters.toLocaleString(document.documentElement.lang || void 0)
            });
            status.hidden = true;
            confirm.removeAttribute("disabled");
          }
        } catch (error) {
          if (request === bufferRequest) {
            status.textContent = error instanceof Error ? error.message : nativeMapText("bufferCreateError");
            status.hidden = false;
          }
        }
      };
      input.addEventListener("calciteInputInput", () => void update());
      label.appendChild(input);
      const actions = document.createElement("div");
      actions.className = "app-native-buffer-actions geo-view-selection-prompt__actions";
      confirm.addEventListener("click", () => {
        var _a2, _b, _c;
        if (confirm.hasAttribute("disabled") || !bufferLayer) {
          return;
        }
        const distanceMeters = Number(input.value);
        const timestamp = Date.now();
        const graphicId = `selection-buffer-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
        const title = nativeMapText("selectionBufferTitle", {
          distance: distanceMeters.toLocaleString(document.documentElement.lang || void 0)
        });
        if (options.onPersistGraphic) {
          const previewGraphic = (_b = (_a2 = bufferLayer.graphics) == null ? void 0 : _a2.toArray) == null ? void 0 : _b.call(_a2)[0];
          const geometry = toSerializableRecord(previewGraphic == null ? void 0 : previewGraphic.geometry);
          if (!geometry) {
            status.textContent = nativeMapText("selectionGeometryError");
            status.hidden = false;
            return;
          }
          const symbol = toSerializableRecord(previewGraphic == null ? void 0 : previewGraphic.symbol);
          const graphic = {
            graphicId,
            title,
            geometryType: "polygon",
            geometry,
            ...symbol ? { symbol } : {},
            visible: true,
            origin: "derived",
            createdAt: timestamp,
            updatedAt: timestamp
          };
          confirm.toggleAttribute("disabled", true);
          clearBuffer();
          host.hidden = true;
          renderDial();
          const persistGraphic = options.onPersistGraphic;
          void persistGraphic(graphic).catch(() => persistGraphic(graphic)).catch((error) => {
            console.error("Buffer persistence failed.", error);
          });
          return;
        }
        bufferLayer.id = graphicId;
        bufferLayer.title = title;
        bufferLayer.listMode = "show";
        bufferLayer = null;
        (_c = options.onMapDocumentChange) == null ? void 0 : _c.call(options);
        host.hidden = true;
        renderDial();
      });
      actions.appendChild(confirm);
      content.append(label, status, actions);
      panel.append(close, content);
      host.appendChild(panel);
      host.hidden = false;
      placeSelectionPopup(host, viewContainer, anchor);
      observePopupPlacement();
      void update();
    };
    const renderPopup = () => {
      var _a2;
      host.classList.remove("app-native-buffer-popup");
      (_a2 = activeFeatureElement == null ? void 0 : activeFeatureElement.destroy) == null ? void 0 : _a2.call(activeFeatureElement);
      activeFeatureElement = null;
      host.replaceChildren();
      const activeFeature = features[activeFeatureIndex];
      if (!activeFeature) {
        host.hidden = true;
        return;
      }
      const panel = document.createElement("calcite-panel");
      panel.className = "geo-view-selection-popup__panel";
      panel.setAttribute(
        "heading",
        selectionCount === 1 ? nativeMapText("selectedFeature") : nativeMapText("selectedFeatures")
      );
      panel.setAttribute("scale", "m");
      const close = createIconButton("x", nativeMapText("closeSelectedFeatures"));
      close.id = "app-native-selection-close";
      close.className = "geo-view-overlay-close-button";
      close.setAttribute("slot", "header-actions-end");
      close.addEventListener("click", () => {
        host.hidden = true;
        renderDial();
      });
      panel.appendChild(close);
      const content = document.createElement("div");
      content.className = "geo-view-selection-popup__content";
      const chips = document.createElement("div");
      chips.className = "geo-view-selection-popup__chips";
      const layerTitle = readSelectionLayerTitle(activeFeature);
      if (layerTitle) {
        chips.appendChild(createSelectionChip(layerTitle));
      }
      const countChip = createSelectionChip(`${selectionCount} selected`);
      countChip.id = "app-native-selection-count";
      countChip.setAttribute("aria-live", "polite");
      chips.appendChild(countChip);
      if (features.length > 1) {
        chips.appendChild(
          createSelectionChip(
            nativeMapText("showFeaturePosition", {
              current: activeFeatureIndex + 1,
              total: features.length
            })
          )
        );
      }
      content.appendChild(chips);
      if (features.length > 1) {
        const nav = document.createElement("div");
        nav.className = "geo-view-selection-popup__nav-actions";
        const previous = createSelectionButton(
          nativeMapText("previous"),
          "app-native-selection-previous"
        );
        const next = createSelectionButton(nativeMapText("next"), "app-native-selection-next");
        previous.toggleAttribute("disabled", activeFeatureIndex === 0);
        next.toggleAttribute("disabled", activeFeatureIndex === features.length - 1);
        previous.addEventListener("click", () => {
          activeFeatureIndex = Math.max(0, activeFeatureIndex - 1);
          renderPopup();
        });
        next.addEventListener("click", () => {
          activeFeatureIndex = Math.min(features.length - 1, activeFeatureIndex + 1);
          renderPopup();
        });
        nav.append(previous, next);
        content.appendChild(nav);
      }
      const sections = document.createElement("div");
      sections.className = "geo-view-selection-popup__sections";
      activeFeatureElement = document.createElement("arcgis-feature");
      activeFeatureElement.id = "app-native-selection-feature";
      activeFeatureElement.className = "geo-view-selection-popup__sdk-feature";
      activeFeatureElement.defaultPopupTemplateEnabled = true;
      activeFeatureElement.graphic = activeFeature;
      activeFeatureElement.headingLevel = 3;
      activeFeatureElement.setAttribute("show-relationship-content", "");
      sections.appendChild(activeFeatureElement);
      content.appendChild(sections);
      const footer = document.createElement("footer");
      footer.className = "geo-view-selection-popup__footer";
      const actions = document.createElement("div");
      actions.className = "geo-view-selection-popup__footer-secondary";
      const attachHandler = targetKind === "graphic" ? options.onAttachGraphic : options.onAttachSelection;
      if (attachHandler) {
        const attach = createSelectionButton(
          nativeMapText("attachToChat"),
          "app-native-selection-attach",
          "brand"
        );
        attach.addEventListener("click", attachHandler);
        actions.appendChild(attach);
      }
      footer.appendChild(actions);
      content.appendChild(footer);
      panel.appendChild(content);
      host.appendChild(panel);
      placeSelectionPopup(host, viewContainer, anchor);
      observePopupPlacement();
    };
    const renderDial = () => {
      host.classList.remove("app-native-buffer-popup");
      dial.replaceChildren();
      if (targetKind === "selection" && features.length === 0) {
        dial.hidden = true;
        return;
      }
      const positioner = document.createElement("div");
      positioner.className = "geo-view-selection-dial__positioner";
      const center = resolveSelectionDialCenter(anchor, viewContainer);
      positioner.style.transform = `translate3d(${center.x}px, ${center.y}px, 0)`;
      if (targetKind === "location" && anchor) {
        const locationMarker = document.createElement("span");
        locationMarker.className = "geo-view-selection-dial__location-point";
        locationMarker.style.left = `${anchor.x}px`;
        locationMarker.style.top = `${anchor.y}px`;
        locationMarker.setAttribute("aria-hidden", "true");
        dial.appendChild(locationMarker);
      }
      const wheel = document.createElement("div");
      wheel.className = "geo-view-selection-dial__wheel";
      const background = document.createElement("img");
      background.alt = "";
      background.className = "geo-view-selection-dial__menu-background";
      background.src = selectionMenuBackground;
      background.setAttribute("aria-hidden", "true");
      const backgroundLine = document.createElement("img");
      backgroundLine.alt = "";
      backgroundLine.className = "geo-view-selection-dial__menu-background-line";
      backgroundLine.src = selectionMenuBackgroundLine;
      backgroundLine.setAttribute("aria-hidden", "true");
      wheel.append(background, backgroundLine);
      const close = createDialButton("close", nativeMapText("closeSpatialSuggestions"), "x", () => {
        var _a2;
        (_a2 = options.onSelectionPopupClose) == null ? void 0 : _a2.call(options);
      });
      close.className = "geo-view-selection-dial__close";
      close.style.left = "-20px";
      close.style.top = "-20px";
      wheel.appendChild(close);
      const readySuggestions = suggestionState.status === "ready" ? suggestionState.suggestions : [];
      const actions = readySuggestions.length > 0 ? [
        ...readySuggestions.slice(0, 3).map((suggestion) => ({
          id: `suggestion:${suggestion.id}`,
          label: suggestion.title,
          title: suggestion.title,
          icon: "automation",
          run: () => {
            var _a2;
            return (_a2 = options.onSuggestionSelected) == null ? void 0 : _a2.call(options, suggestion.id);
          }
        })),
        {
          id: "back",
          label: nativeMapText("back"),
          title: nativeMapText("backToSelectionActions"),
          icon: "arrow-left",
          run: () => {
            suggestionState = { status: "clear", selectionRevision: 0 };
            renderDial();
          }
        }
      ] : [
        targetKind === "location" ? {
          id: "mark",
          label: nativeMapText("mark"),
          title: nativeMapText("markLocation"),
          icon: "pin",
          disabled: markSaving || !options.onPersistGraphic && (!GraphicsLayer || !Graphic),
          run: markLocation
        } : {
          id: "details",
          label: nativeMapText("details"),
          title: nativeMapText("viewDetails"),
          icon: "article",
          run: () => {
            dial.hidden = true;
            placeSelectionPopup(host, viewContainer, anchor);
            host.hidden = false;
            renderPopup();
          }
        },
        {
          id: "ask",
          label: nativeMapText("ask"),
          title: nativeMapText("askNova"),
          icon: "ai-chat",
          disabled: targetKind === "location" ? !options.onAttachLocation : targetKind === "graphic" ? !options.onAttachGraphic : !options.onAttachSelection,
          run: () => {
            var _a2, _b, _c;
            return targetKind === "location" ? (_a2 = options.onAttachLocation) == null ? void 0 : _a2.call(options) : targetKind === "graphic" ? (_b = options.onAttachGraphic) == null ? void 0 : _b.call(options) : (_c = options.onAttachSelection) == null ? void 0 : _c.call(options);
          }
        },
        {
          id: "buffer",
          label: nativeMapText("buffer"),
          title: nativeMapText("bufferSelection"),
          icon: "rings",
          disabled: !resources.moduleLoader || (targetKind === "location" ? !locationPoint : !features.some((feature) => feature.geometry)),
          run: renderBuffer
        },
        {
          id: "suggest",
          label: suggestionState.status === "loading" ? nativeMapText("thinking") : nativeMapText("suggest"),
          title: nativeMapText("suggestRelevantActions"),
          icon: "lightbulb",
          disabled: (targetKind === "location" ? !options.onRequestLocationSuggestions : targetKind === "graphic" ? !options.onRequestGraphicSuggestions : !options.onRequestSpatialSuggestions) || suggestionState.status === "loading",
          run: () => {
            var _a2, _b, _c;
            return targetKind === "location" ? (_a2 = options.onRequestLocationSuggestions) == null ? void 0 : _a2.call(options) : targetKind === "graphic" ? (_b = options.onRequestGraphicSuggestions) == null ? void 0 : _b.call(options) : (_c = options.onRequestSpatialSuggestions) == null ? void 0 : _c.call(options);
          }
        }
      ];
      actions.forEach((action, index) => {
        var _a2;
        const button = createDialButton(action.id, action.title, action.icon, action.run);
        button.className = `geo-view-selection-dial__action${action.id === "suggest" ? " geo-view-selection-dial__action--agentic" : ""}`;
        button.disabled = (_a2 = action.disabled) != null ? _a2 : false;
        button.style.left = `${SELECTION_DIAL_ACTION_OFFSETS[index].x - SELECTION_DIAL_ACTION_DIAMETER / 2}px`;
        button.style.top = `${SELECTION_DIAL_ACTION_OFFSETS[index].y - SELECTION_DIAL_ACTION_DIAMETER / 2}px`;
        if (action.id === "suggest") {
          const hoverEffect = document.createElement("img");
          hoverEffect.alt = "";
          hoverEffect.className = "geo-view-selection-dial__suggest-hover-effect";
          hoverEffect.src = selectionSuggestHoverBackground;
          button.appendChild(hoverEffect);
          if (suggestionState.status === "loading") {
            button.classList.add("geo-view-selection-dial__action--thinking");
            const thinkingEffect = document.createElement("img");
            thinkingEffect.alt = "";
            thinkingEffect.className = "geo-view-selection-dial__suggest-thinking-effect";
            thinkingEffect.src = selectionSuggestThinkingBackground;
            button.appendChild(thinkingEffect);
          }
        }
        const label = document.createElement("span");
        label.className = "geo-view-selection-dial__action-label";
        label.textContent = action.label;
        button.appendChild(label);
        wheel.appendChild(button);
      });
      positioner.appendChild(wheel);
      dial.appendChild(positioner);
      dial.setAttribute("aria-busy", String(markSaving));
      if (markStatus) {
        const status = document.createElement("p");
        status.id = "app-native-mark-status";
        status.className = "geo-view-selection-dial__status";
        status.setAttribute("role", "status");
        status.textContent = markStatus;
        dial.appendChild(status);
      }
      dial.hidden = false;
    };
    let disposed = false;
    const clear = () => {
      var _a2;
      clearBuffer();
      clearMark();
      features = [];
      targetKind = "selection";
      locationPoint = void 0;
      activeFeatureIndex = 0;
      selectionCount = 0;
      suggestionState = { status: "clear", selectionRevision: 0 };
      anchor = void 0;
      (_a2 = activeFeatureElement == null ? void 0 : activeFeatureElement.destroy) == null ? void 0 : _a2.call(activeFeatureElement);
      activeFeatureElement = null;
      host.replaceChildren();
      host.hidden = true;
      dial.replaceChildren();
      dial.hidden = true;
    };
    return {
      show: (input) => {
        var _a2;
        if (disposed || input.kind === "selection" && input.features.length === 0) {
          clear();
          return;
        }
        clearBuffer();
        clearMark();
        targetKind = (_a2 = input.kind) != null ? _a2 : "selection";
        features = targetKind === "selection" ? input.features : targetKind === "graphic" ? [input.feature] : [];
        locationPoint = targetKind === "location" ? input.mapPoint : void 0;
        activeFeatureIndex = 0;
        selectionCount = targetKind === "selection" ? input.selectionCount : targetKind === "graphic" ? 1 : 0;
        anchor = input.anchor;
        suggestionState = { status: "clear", selectionRevision: 0 };
        host.hidden = true;
        renderDial();
      },
      clear,
      setSuggestions: (state) => {
        suggestionState = state;
        if (!dial.hidden) {
          renderDial();
        } else if (!host.hidden) {
          renderPopup();
        }
      },
      dispose: () => {
        var _a2, _b, _c, _d;
        if (disposed) {
          return;
        }
        disposed = true;
        popupResizeObserver == null ? void 0 : popupResizeObserver.disconnect();
        clear();
        if (mountedInViewUi) {
          (_b = (_a2 = resources.view.ui) == null ? void 0 : _a2.remove) == null ? void 0 : _b.call(_a2, dial);
          (_d = (_c = resources.view.ui) == null ? void 0 : _c.remove) == null ? void 0 : _d.call(_c, host);
        }
        dial.remove();
        host.remove();
      }
    };
  }
  function toSerializableRecord(value) {
    const serialized = toLegendFingerprintValue(value, /* @__PURE__ */ new WeakSet());
    return serialized && typeof serialized === "object" && !Array.isArray(serialized) ? serialized : null;
  }
  async function drawSelectionBuffer(resources, features, distanceMeters, request, readRequest, setLayer) {
    var _a, _b, _c, _d, _e, _f;
    if (!resources.moduleLoader) {
      throw new Error(nativeMapText("arcgisBufferUnavailable"));
    }
    const GraphicsLayer = resources.modules["esri/layers/GraphicsLayer"];
    const Graphic = resources.modules["esri/Graphic"];
    if (!GraphicsLayer || !Graphic) {
      throw new Error(nativeMapText("arcgisBufferUnavailable"));
    }
    const [bufferOperator, geodesicBufferOperator] = await Promise.all([
      resources.moduleLoader("esri/geometry/operators/bufferOperator"),
      resources.moduleLoader("esri/geometry/operators/geodesicBufferOperator")
    ]);
    if (request !== readRequest()) {
      return;
    }
    const usesGeodesicBuffer = features.some((feature) => {
      var _a2;
      const spatialReference = (_a2 = feature.geometry) == null ? void 0 : _a2.spatialReference;
      return (spatialReference == null ? void 0 : spatialReference.wkid) === 4326 || (spatialReference == null ? void 0 : spatialReference.isWebMercator) === true;
    });
    if (usesGeodesicBuffer) {
      if (typeof geodesicBufferOperator.load !== "function") {
        throw new Error(nativeMapText("arcgisBufferUnavailable"));
      }
      await geodesicBufferOperator.load();
      if (request !== readRequest()) {
        return;
      }
    }
    const bufferedGeometries = features.flatMap((feature) => {
      if (!feature.geometry) {
        return [];
      }
      const spatialReference = feature.geometry.spatialReference;
      const useGeodesic = (spatialReference == null ? void 0 : spatialReference.wkid) === 4326 || (spatialReference == null ? void 0 : spatialReference.isWebMercator) === true;
      const operation = useGeodesic ? geodesicBufferOperator.execute : bufferOperator.execute;
      if (typeof operation !== "function") {
        throw new Error(nativeMapText("arcgisBufferUnavailable"));
      }
      const geometry2 = operation(feature.geometry, distanceMeters, { unit: "meters" });
      if (!geometry2) {
        return [];
      }
      return [geometry2];
    });
    if (bufferedGeometries.length === 0) {
      throw new Error(nativeMapText("selectionGeometryError"));
    }
    let geometry = bufferedGeometries[0];
    if (bufferedGeometries.length > 1) {
      const unionOperator = await resources.moduleLoader(
        "esri/geometry/operators/unionOperator"
      );
      if (request !== readRequest()) {
        return;
      }
      if (typeof unionOperator.executeMany !== "function") {
        throw new Error(nativeMapText("arcgisBufferUnavailable"));
      }
      geometry = unionOperator.executeMany(bufferedGeometries);
    }
    if (!geometry) {
      throw new Error(nativeMapText("selectionGeometryError"));
    }
    const graphics = [
      new Graphic({
        geometry,
        symbol: {
          type: "simple-fill",
          color: [249, 134, 49, 0.18],
          outline: { color: [249, 134, 49, 0.95], width: 2 }
        }
      })
    ];
    const previous = (_b = (_a = resources.map).findLayerById) == null ? void 0 : _b.call(_a, SELECTION_BUFFER_LAYER_ID);
    if (previous) {
      (_d = (_c = resources.map).remove) == null ? void 0 : _d.call(_c, previous);
    }
    const layer = new GraphicsLayer({
      id: SELECTION_BUFFER_LAYER_ID,
      title: nativeMapText("selectionBuffer"),
      graphics,
      listMode: "hide"
    });
    (_f = (_e = resources.map).add) == null ? void 0 : _f.call(_e, layer);
    setLayer(layer);
  }
  function createDialButton(actionId, title, iconName, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.actionId = actionId;
    button.title = title;
    button.setAttribute("aria-label", actionId === "close" ? title : title.split(" ")[0]);
    const iconContainer = document.createElement("span");
    iconContainer.className = "geo-view-selection-dial__action-icon";
    if (actionId === "ask" || actionId === "suggest") {
      const image = document.createElement("img");
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.className = actionId === "ask" ? "geo-view-selection-dial__ask-icon" : "geo-view-selection-dial__suggest-icon";
      const source = actionId === "ask" ? selectionAskIcon : selectionSuggestIcon;
      if (source) {
        image.src = source;
      }
      iconContainer.appendChild(image);
    } else {
      const icon = document.createElement("calcite-icon");
      icon.setAttribute("icon", iconName);
      icon.setAttribute("scale", "s");
      iconContainer.appendChild(icon);
    }
    button.appendChild(iconContainer);
    button.addEventListener("click", onClick);
    return button;
  }
  function resolveSelectionDialCenter(anchor, container) {
    var _a, _b;
    const width = (container == null ? void 0 : container.clientWidth) || globalThis.innerWidth || 800;
    const height = (container == null ? void 0 : container.clientHeight) || globalThis.innerHeight || 600;
    const x = (_a = anchor == null ? void 0 : anchor.x) != null ? _a : width / 2;
    const y = (_b = anchor == null ? void 0 : anchor.y) != null ? _b : height / 2;
    return {
      x: Math.min(Math.max(x, 107), Math.max(107, width - 116)),
      y: Math.min(Math.max(y - 44, 123), Math.max(123, height - 91))
    };
  }
  function createSelectionChip(text) {
    const chip = document.createElement("calcite-chip");
    chip.setAttribute("appearance", "outline");
    chip.setAttribute("scale", "s");
    chip.textContent = text;
    return chip;
  }
  function createSelectionButton(text, id, kind = "neutral") {
    const button = document.createElement("calcite-button");
    button.id = id;
    button.textContent = text;
    button.setAttribute("appearance", "outline");
    button.setAttribute("kind", kind);
    button.setAttribute("scale", "s");
    return button;
  }
  function readSelectionLayerTitle(graphic) {
    var _a;
    const layer = (_a = graphic.layer) != null ? _a : graphic.sourceLayer;
    if (typeof layer !== "object" || layer === null || !("title" in layer)) {
      return "";
    }
    return typeof layer.title === "string" ? layer.title.trim() : "";
  }
  function placeSelectionPopup(host, container, anchor) {
    var _a;
    if (!anchor) {
      host.style.removeProperty("left");
      host.style.removeProperty("top");
      return;
    }
    const margin = 12;
    const gap = 12;
    const containerWidth = (container == null ? void 0 : container.clientWidth) || globalThis.innerWidth || 800;
    const containerHeight = (container == null ? void 0 : container.clientHeight) || globalThis.innerHeight || 600;
    const availableHeight = Math.max(0, containerHeight - margin * 2);
    host.style.setProperty("--geo-view-selection-popup-available-height", `${availableHeight}px`);
    const bounds = ((_a = host.querySelector("calcite-panel")) != null ? _a : host).getBoundingClientRect();
    const popupWidth = bounds.width || Math.min(416, Math.max(0, containerWidth - margin * 2));
    const popupHeight = bounds.height || Math.min(512, availableHeight);
    const preferredLeft = anchor.x + gap;
    const preferredTop = anchor.y + gap;
    const left = preferredLeft + popupWidth <= containerWidth - margin ? preferredLeft : anchor.x - popupWidth - gap;
    const top = preferredTop + popupHeight <= containerHeight - margin ? preferredTop : anchor.y - popupHeight - gap;
    host.style.left = `${Math.min(Math.max(left, margin), Math.max(margin, containerWidth - popupWidth - margin))}px`;
    host.style.top = `${Math.min(Math.max(top, margin), Math.max(margin, containerHeight - popupHeight - margin))}px`;
  }

  // src/frame/pointer-input.ts
  function readGraphicLayerInfo(graphic) {
    if (isRecord4(graphic == null ? void 0 : graphic.layer)) {
      return graphic.layer;
    }
    return isRecord4(graphic == null ? void 0 : graphic.sourceLayer) ? graphic.sourceLayer : null;
  }
  function readHitTestGraphicMatch(result) {
    if (!result.graphic) {
      return null;
    }
    const hitLayer = isRecord4(result.layer) ? result.layer : null;
    const layer = typeof (hitLayer == null ? void 0 : hitLayer.id) === "string" && hitLayer.id ? hitLayer : readGraphicLayerInfo(result.graphic);
    return typeof (layer == null ? void 0 : layer.id) === "string" && layer.id ? { graphic: result.graphic, layer } : null;
  }
  function readScreenAnchor(event) {
    if (!isRecord4(event)) {
      return null;
    }
    return typeof event.x === "number" && Number.isFinite(event.x) && typeof event.y === "number" && Number.isFinite(event.y) ? { x: event.x, y: event.y } : null;
  }
  function readPointerInput(event) {
    const point = readScreenAnchor(event);
    if (!point || !isRecord4(event)) {
      return null;
    }
    const nativeEvent = isRecord4(event.native) ? event.native : null;
    const button = typeof event.button === "number" ? event.button : typeof (nativeEvent == null ? void 0 : nativeEvent.button) === "number" ? nativeEvent.button : void 0;
    return button === void 0 ? point : { ...point, button };
  }
  function readRuntimeMapLocation(value) {
    const candidate = isRecord4(value) && typeof value.toJSON === "function" ? value.toJSON() : value;
    if (!isRecord4(candidate) || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
      return null;
    }
    const spatialReference = isRecord4(candidate.spatialReference) ? {
      ...Number.isFinite(candidate.spatialReference.wkid) ? { wkid: candidate.spatialReference.wkid } : {},
      ...typeof candidate.spatialReference.wkt === "string" ? { wkt: candidate.spatialReference.wkt } : {}
    } : void 0;
    return {
      x: candidate.x,
      y: candidate.y,
      ...spatialReference && Object.keys(spatialReference).length > 0 ? { spatialReference } : {}
    };
  }
  function readSelectionSuggestionState(payload) {
    if (!Number.isSafeInteger(payload.selectionRevision) || payload.selectionRevision <= 0) {
      throw new Error("set-selection-suggestions requires a positive selectionRevision.");
    }
    const selectionRevision = payload.selectionRevision;
    if (payload.status === "clear" || payload.status === "loading" || payload.status === "error") {
      return { status: payload.status, selectionRevision };
    }
    if (payload.status !== "ready" || !Array.isArray(payload.suggestions)) {
      throw new Error("set-selection-suggestions requires clear, loading, ready, or error state.");
    }
    const suggestions = payload.suggestions.flatMap((value) => {
      if (!isRecord4(value) || Object.keys(value).some((key) => key !== "id" && key !== "title")) {
        return [];
      }
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const title = typeof value.title === "string" ? value.title.trim() : "";
      return id && id.length <= 128 && title && title.length <= 120 ? [{ id, title }] : [];
    });
    if (suggestions.length !== payload.suggestions.length || suggestions.length > 3) {
      throw new Error("set-selection-suggestions contains an invalid suggestion presentation.");
    }
    return { status: "ready", selectionRevision, suggestions };
  }

  // src/frame/regions.ts
  function regionElement(name) {
    return document.getElementById(`app-region-${name}`);
  }
  function regionWidthProperty(name) {
    if (name === "left") {
      return "--app-left-region-width";
    }
    if (name === "right") {
      return "--app-right-region-width";
    }
    return null;
  }
  function renderRegion(name, region) {
    const host = regionElement(name);
    if (!host) {
      return;
    }
    const preferredWidthProperty = regionWidthProperty(name);
    const layout = document.querySelector("main.app-main");
    layout == null ? void 0 : layout.style.removeProperty(preferredWidthProperty != null ? preferredWidthProperty : "");
    host.setAttribute("data-region", name);
    host.replaceChildren();
    host.hidden = !region || region.hidden || region.blocks.length === 0;
    if (host.hidden || !region) {
      return;
    }
    host.style.removeProperty("width");
    host.style.removeProperty("height");
    if (region.width) {
      if (preferredWidthProperty) {
        layout == null ? void 0 : layout.style.setProperty(preferredWidthProperty, region.width);
      } else {
        host.style.width = region.width;
      }
    }
    if (region.height) {
      host.style.height = region.height;
    }
    host.removeAttribute("data-collapsed");
    if (region.title) {
      const title = document.createElement("h2");
      title.className = "app-region-title";
      if (region.icon) {
        title.appendChild(createIcon(region.icon));
      }
      const label = document.createElement("span");
      label.className = "app-region-title-text";
      label.textContent = region.title;
      title.appendChild(label);
      host.appendChild(title);
      if (preferredWidthProperty && layout) {
        title.appendChild(foldControl(name, host, layout, preferredWidthProperty, region));
      }
    }
    const body = document.createElement("div");
    body.className = "app-region-body";
    region.blocks.forEach((block) => body.appendChild(renderBlock(block)));
    host.appendChild(body);
  }
  var FOLDED_WIDTH = "3rem";
  function foldControl(name, host, layout, widthProperty, region) {
    const action = document.createElement("calcite-action");
    action.className = "app-region-fold";
    action.setAttribute("scale", "s");
    const apply = (folded) => {
      var _a, _b;
      host.toggleAttribute("data-collapsed", folded);
      const towardEdge = name === "left" ? "chevrons-left" : "chevrons-right";
      const awayFromEdge = name === "left" ? "chevrons-right" : "chevrons-left";
      action.setAttribute("icon", folded ? awayFromEdge : towardEdge);
      action.setAttribute(
        "text",
        folded ? `Expand ${(_a = region.title) != null ? _a : "panel"}` : `Collapse ${(_b = region.title) != null ? _b : "panel"}`
      );
      if (folded) {
        layout.style.setProperty(widthProperty, FOLDED_WIDTH);
      } else if (region.width) {
        layout.style.setProperty(widthProperty, region.width);
      } else {
        layout.style.removeProperty(widthProperty);
      }
    };
    action.addEventListener("click", () => apply(!host.hasAttribute("data-collapsed")));
    apply(region.collapsed === true);
    return action;
  }
  function renderRegions(config) {
    ["header", "left", "right", "footer"].forEach((name) => {
      renderRegion(name, config.app.layout[name]);
    });
  }

  // src/frame/runtime-selection-controller.ts
  var RUNTIME_SELECTION_MAX_FEATURES = FEATURE_SELECTION_SNAPSHOT_MAX_OBJECT_IDS;
  var RUNTIME_LOCATION_HOLD_DURATION_MS = 500;
  var RUNTIME_LOCATION_HOLD_MOVEMENT_PX = 5;
  function createRuntimeLocationHoldController(options) {
    var _a, _b;
    const setTimer = (_a = options.setTimer) != null ? _a : setTimeout;
    const clearTimer = (_b = options.clearTimer) != null ? _b : clearTimeout;
    let startPoint = null;
    let timer = null;
    let generation = 0;
    let disposed = false;
    const cancel = () => {
      generation += 1;
      startPoint = null;
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
    };
    return {
      begin(event) {
        cancel();
        if (disposed || event.button !== void 0 && event.button !== 0 || !isFiniteScreenPoint(event)) {
          return;
        }
        startPoint = { x: event.x, y: event.y };
        const holdGeneration = generation;
        timer = setTimer(() => {
          timer = null;
          const point = startPoint;
          if (!point || disposed || holdGeneration !== generation) {
            return;
          }
          void options.onHold(point, () => !disposed && holdGeneration === generation);
        }, RUNTIME_LOCATION_HOLD_DURATION_MS);
      },
      move(event) {
        if (!startPoint || !isFiniteScreenPoint(event)) {
          return;
        }
        if (Math.hypot(event.x - startPoint.x, event.y - startPoint.y) > RUNTIME_LOCATION_HOLD_MOVEMENT_PX) {
          cancel();
        }
      },
      end() {
        if (timer !== null) {
          cancel();
        }
      },
      cancel,
      dispose() {
        disposed = true;
        cancel();
      }
    };
  }
  function isFiniteScreenPoint(value) {
    return Number.isFinite(value.x) && Number.isFinite(value.y);
  }
  function selectRuntimeClickFeatures(matches) {
    var _a, _b, _c;
    const first = matches.find((match) => readStableFeatureId(match) !== null);
    if (!first) {
      return null;
    }
    const ids = [];
    const graphics = [];
    const selectedMatches = [];
    const seen = /* @__PURE__ */ new Set();
    const popupTemplate = (_c = first.layer.popupTemplate) != null ? _c : (_b = (_a = first.layer).createPopupTemplate) == null ? void 0 : _b.call(_a);
    for (const match of matches) {
      if (match.layer.id !== first.layer.id) {
        continue;
      }
      const featureId = readStableFeatureId(match);
      if (featureId === null || seen.has(featureId)) {
        continue;
      }
      seen.add(featureId);
      ids.push(featureId);
      graphics.push(withPopupTemplate(match.graphic, popupTemplate));
      selectedMatches.push(match);
      if (ids.length === RUNTIME_SELECTION_MAX_FEATURES) {
        break;
      }
    }
    return ids.length > 0 ? { layerId: first.layer.id, ids, graphics, matches: selectedMatches } : null;
  }
  function readStableFeatureId(match) {
    var _a, _b, _c, _d;
    const direct = (_b = (_a = match.graphic).getObjectId) == null ? void 0 : _b.call(_a);
    if (typeof direct === "string" || typeof direct === "number") {
      const value2 = String(direct).trim();
      return value2 || null;
    }
    const field = (_c = match.layer.objectIdField) == null ? void 0 : _c.trim();
    if (!field) {
      return null;
    }
    const attribute = (_d = match.graphic.attributes) == null ? void 0 : _d[field];
    if (typeof attribute !== "string" && typeof attribute !== "number") {
      return null;
    }
    const value = String(attribute).trim();
    return value || null;
  }
  function withPopupTemplate(graphic, popupTemplate) {
    if (graphic.popupTemplate == null) {
      graphic.popupTemplate = popupTemplate;
    }
    return graphic;
  }

  // src/frame/script-execution.ts
  var MAX_RESULT_JSON_LENGTH = 64 * 1024;
  var MAX_ERROR_LENGTH = 8 * 1024;
  function failure(code, error, startedAt) {
    const source = error instanceof Error ? error : new Error(String(error));
    return {
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: {
        code,
        message: truncate(source.message, MAX_ERROR_LENGTH),
        ...source.stack ? { stack: truncate(source.stack, MAX_ERROR_LENGTH) } : {}
      }
    };
  }
  async function runWithTimeout(execute, timeoutMs) {
    const startedAt = Date.now();
    let timeout;
    try {
      return await Promise.race([
        execute().then(
          (result) => ({
            status: "succeeded",
            durationMs: Date.now() - startedAt,
            result
          }),
          (error) => timedFailure("SCRIPT_RUNTIME_ERROR", error, startedAt)
        ),
        new Promise((resolve) => {
          timeout = setTimeout(
            () => resolve({
              status: "timed-out",
              durationMs: Date.now() - startedAt,
              error: {
                code: "SCRIPT_TIMEOUT",
                message: `The app script did not settle within ${timeoutMs} ms. It may continue running in the app, but its later changes cannot be persisted by this command.`
              }
            }),
            timeoutMs
          );
        })
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
  function toCloneSafeResult(value) {
    if (value === void 0) {
      return { kind: "undefined" };
    }
    if (typeof value === "string") {
      return toBoundedStringResult(value);
    }
    try {
      const seen = /* @__PURE__ */ new WeakSet();
      const json = JSON.stringify(value, (_key, candidate) => {
        if (typeof candidate === "bigint") {
          return candidate.toString();
        }
        if (typeof candidate === "function") {
          return "[Function]";
        }
        if (candidate instanceof Error) {
          return {
            name: candidate.name,
            message: candidate.message,
            ...candidate.stack ? { stack: candidate.stack } : {}
          };
        }
        if (candidate && typeof candidate === "object") {
          if (seen.has(candidate)) {
            return "[Circular]";
          }
          seen.add(candidate);
        }
        return candidate;
      });
      if (json === void 0) {
        return toBoundedStringResult(String(value));
      }
      return json.length <= MAX_RESULT_JSON_LENGTH ? { kind: "json", value: json } : {
        kind: "truncated",
        preview: json.slice(0, MAX_RESULT_JSON_LENGTH),
        originalLength: json.length
      };
    } catch {
      return toBoundedStringResult(String(value));
    }
  }
  function toBoundedStringResult(value) {
    return value.length <= MAX_RESULT_JSON_LENGTH ? { kind: "string", value } : {
      kind: "truncated",
      preview: value.slice(0, MAX_RESULT_JSON_LENGTH),
      originalLength: value.length
    };
  }
  function truncate(value, maximum) {
    return value.length <= maximum ? value : `${value.slice(0, maximum)}…`;
  }
  function timedFailure(code, error, startedAt) {
    const result = failure(code, error, startedAt);
    return {
      status: result.status,
      durationMs: result.durationMs,
      error: result.error
    };
  }

  // src/frame/theme.ts
  var ARCGIS_THEME_HREF_PATTERN = /\/esri\/themes\/(?:light|dark)\//u;
  function applyAppTheme(mode, accent) {
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.accent = accent;
    document.body.classList.toggle("calcite-mode-dark", mode === "dark");
    document.body.classList.toggle("calcite-mode-light", mode === "light");
    swapArcgisThemeStylesheet(mode);
    restampCalciteMode(mode);
  }
  function swapArcgisThemeStylesheet(mode) {
    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || !ARCGIS_THEME_HREF_PATTERN.test(href)) {
        return;
      }
      const next = href.replace(ARCGIS_THEME_HREF_PATTERN, `/esri/themes/${mode}/`);
      if (next !== href) {
        link.setAttribute("href", next);
      }
    });
  }
  function restampCalciteMode(mode) {
    const stale = mode === "dark" ? "calcite-mode-light" : "calcite-mode-dark";
    document.querySelectorAll(`.${stale}`).forEach((element2) => {
      element2.classList.remove(stale);
      element2.classList.add(`calcite-mode-${mode}`);
    });
  }

  // src/frame/visualization.ts
  function isRecord5(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function toJson2(value) {
    const candidate = value;
    if (!candidate || typeof candidate.toJSON !== "function") {
      return isRecord5(value) ? value : void 0;
    }
    const json = candidate.toJSON();
    return isRecord5(json) ? json : void 0;
  }
  function readString2(params, key) {
    const value = params[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
  }
  function readNumber(params, key) {
    const value = params[key];
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function readFieldNames(params) {
    const values = params.values;
    if (Array.isArray(values)) {
      return values.map((entry) => isRecord5(entry) ? entry.fieldName : void 0).filter((name) => typeof name === "string" && name.length > 0);
    }
    const single = readString2(params, "fieldName");
    return single ? [single] : [];
  }
  async function loadLayer(context, layerId) {
    var _a;
    const layer = context.findLayerById(layerId);
    if (!layer) {
      throw new Error(`The Project Output has no layer "${layerId}".`);
    }
    await ((_a = layer.load) == null ? void 0 : _a.call(layer));
    return layer;
  }
  function resolveAutoRendererOp(layer, params) {
    if (readString2(params, "preferredRenderer") === "simple") {
      return "renderer_location";
    }
    const fieldName = readFieldNames(params)[0];
    if (!fieldName) {
      return "renderer_location";
    }
    const preferred = readString2(params, "preferredRenderer");
    if (preferred === "unique-values") {
      return "renderer_unique_values";
    }
    if (preferred === "class-breaks") {
      return "renderer_class_breaks";
    }
    const fields = Array.isArray(layer.fields) ? layer.fields : [];
    const field = fields.find(
      (entry) => isRecord5(entry) && (entry.name === fieldName || entry.alias === fieldName)
    );
    const type = isRecord5(field) && typeof field.type === "string" ? field.type : "";
    const numeric = ["small-integer", "integer", "single", "double", "long", "big-integer"].includes(
      type
    );
    return numeric ? "renderer_class_breaks" : "renderer_unique_values";
  }
  function describeRenderer(renderer) {
    if (!renderer) {
      return {};
    }
    const evidence = {};
    if (typeof renderer.type === "string") {
      evidence.rendererType = renderer.type;
    }
    if (typeof renderer.field === "string") {
      evidence.fields = [renderer.field];
    }
    const classBreakInfos = renderer.classBreakInfos;
    if (Array.isArray(classBreakInfos)) {
      evidence.classCount = classBreakInfos.length;
      evidence.classBreaks = classBreakInfos.filter(isRecord5).map((info) => ({
        min: typeof info.minValue === "number" ? info.minValue : void 0,
        max: typeof info.maxValue === "number" ? info.maxValue : void 0,
        label: typeof info.label === "string" ? info.label : void 0
      }));
    }
    const uniqueValueInfos = renderer.uniqueValueInfos;
    if (Array.isArray(uniqueValueInfos)) {
      evidence.uniqueValueCount = uniqueValueInfos.length;
    }
    return evidence;
  }
  async function createRendererVisualization(context, op, layer, params) {
    const view = context.view;
    const fields = readFieldNames(params);
    const field = fields[0];
    const creatorModule = async (moduleId) => await context.importModule(moduleId);
    const call = async (moduleId, method, creatorParams) => {
      const module = await creatorModule(moduleId);
      const creator = module[method];
      if (typeof creator !== "function") {
        throw new Error(
          `The ArcGIS Smart Mapping creator "${method}" is unavailable in this SDK build.`
        );
      }
      const response = await creator({
        layer,
        view,
        ...creatorParams
      });
      return isRecord5(response) ? toJson2(response.renderer) : void 0;
    };
    let renderer;
    switch (op) {
      case "renderer_location":
        renderer = await call("esri/smartMapping/renderers/location", "createRenderer", {});
        break;
      case "renderer_class_breaks":
        if (!field) {
          throw new Error("A class-breaks renderer needs one numeric field from the live layer.");
        }
        renderer = await call("esri/smartMapping/renderers/color", "createClassBreaksRenderer", {
          field,
          ...readString2(params, "classificationMethod") ? { classificationMethod: readString2(params, "classificationMethod") } : {},
          ...readNumber(params, "classCount") ? { numClasses: readNumber(params, "classCount") } : {}
        });
        break;
      case "renderer_unique_values":
        if (!field) {
          throw new Error(
            "A unique-values renderer needs one categorical field from the live layer."
          );
        }
        renderer = await call("esri/smartMapping/renderers/type", "createRenderer", { field });
        break;
      case "renderer_heatmap":
        renderer = await call("esri/smartMapping/renderers/heatmap", "createRenderer", {
          ...field ? { field } : {}
        });
        break;
      default:
        throw new Error(`Visualization operation "${op}" has no creator on this surface.`);
    }
    if (!renderer) {
      throw new Error(`The creator for "${op}" returned no renderer.`);
    }
    return {
      properties: { renderer },
      evidence: { ...describeRenderer(renderer), ...fields.length > 1 ? { fields } : {} }
    };
  }
  function resolveFieldName(layer, requested) {
    var _a, _b, _c, _d, _e;
    const fields = Array.isArray(layer.fields) ? layer.fields.filter(isRecord5) : [];
    const match = (_c = (_b = (_a = fields.find((field) => field.name === requested)) != null ? _a : fields.find((field) => field.alias === requested)) != null ? _b : fields.find(
      (field) => typeof field.name === "string" && field.name.toLowerCase() === requested.toLowerCase()
    )) != null ? _c : fields.find(
      (field) => typeof field.alias === "string" && field.alias.toLowerCase() === requested.toLowerCase()
    );
    if (!match || typeof match.name !== "string") {
      const present = fields.map((field) => typeof field.name === "string" ? field.name : "").filter((name) => name.length > 0);
      throw new Error(
        `Layer "${String((_e = (_d = layer.title) != null ? _d : layer.id) != null ? _e : "")}" has no field "${requested}". Present: ${present.join(", ")}`
      );
    }
    return {
      name: match.name,
      alias: typeof match.alias === "string" && match.alias.length > 0 ? match.alias : match.name
    };
  }
  var DEFAULT_LABEL_SYMBOL = {
    color: [40, 40, 40, 1],
    haloColor: [255, 255, 255, 1],
    haloSize: 1,
    font: { size: 11, family: "Avenir Next", weight: "normal" }
  };
  async function createLabeling(context, layer, params) {
    const requested = readString2(params, "fieldName");
    if (!requested) {
      throw new Error("Labelling needs one field from the live layer schema.");
    }
    const field = resolveFieldName(layer, requested);
    const placement = readString2(params, "placement");
    const minScale = readNumber(params, "minScale");
    const maxScale = readNumber(params, "maxScale");
    const symbol = isRecord5(params.labelSymbol) ? params.labelSymbol : {};
    const font = isRecord5(symbol.font) ? symbol.font : {};
    const LabelClass = await context.importModule("esri/layers/support/LabelClass");
    const labelClass = new LabelClass({
      labelExpressionInfo: { expression: `$feature["${field.name}"]` },
      symbol: {
        ...DEFAULT_LABEL_SYMBOL,
        ...symbol,
        type: "text",
        font: { ...DEFAULT_LABEL_SYMBOL.font, ...font }
      },
      ...placement ? { labelPlacement: placement } : {},
      ...minScale !== void 0 ? { minScale } : {},
      ...maxScale !== void 0 ? { maxScale } : {}
    }).toJSON();
    if (placement && !labelClass.labelPlacement) {
      throw new Error(`Label placement "${placement}" is not one this SDK build accepts.`);
    }
    return {
      properties: { labelingInfo: [labelClass] },
      evidence: { fields: [field.name], labelPlacement: placement != null ? placement : "sdk-default" }
    };
  }
  function createPopupTemplate(layer, params) {
    var _a;
    const requestedInfos = Array.isArray(params.fieldInfos) ? params.fieldInfos.filter(isRecord5) : [];
    const expression = readString2(params, "expression");
    if (requestedInfos.length === 0 && !expression) {
      throw new Error(
        "A popup needs at least one field from the live layer schema, or an Arcade expression."
      );
    }
    const fieldInfos = requestedInfos.map((info) => {
      const requested = typeof info.fieldName === "string" ? info.fieldName : "";
      const field = resolveFieldName(layer, requested);
      const format = info.formatKind === "number" ? {
        format: {
          places: typeof info.places === "number" ? info.places : 0,
          digitSeparator: info.digitSeparator !== false
        }
      } : info.formatKind === "date" && typeof info.dateFormat === "string" ? { format: { dateFormat: info.dateFormat } } : {};
      return {
        fieldName: field.name,
        label: typeof info.label === "string" && info.label.length > 0 ? info.label : field.alias,
        visible: true,
        ...format
      };
    });
    const rawTitle = (_a = readString2(params, "title")) != null ? _a : "";
    const title = rawTitle.replace(/\{([^}]+)\}/gu, (_match, name) => {
      try {
        return `{${resolveFieldName(layer, name.trim()).name}}`;
      } catch {
        return `{${name}}`;
      }
    });
    const contentStyle = readString2(params, "contentStyle");
    const content = [
      ...fieldInfos.length > 0 ? [{ type: "fields", fieldInfos }] : [],
      ...expression ? [{ type: "expression", expressionInfo: { expression } }] : []
    ];
    return {
      properties: {
        popupTemplate: {
          title,
          // The content elements name the fields; a template's own `fieldInfos` is what formats them
          // and what lets an expression's `$feature` read a field the layer does not otherwise fetch.
          fieldInfos,
          content,
          ...contentStyle === "table" || contentStyle === "list" ? { contentStyle } : {}
        }
      },
      evidence: { fields: fieldInfos.map((info) => info.fieldName) }
    };
  }
  async function createLayerVisualization(context, payload) {
    const op = typeof payload.op === "string" ? payload.op : "";
    const layerId = typeof payload.layerId === "string" ? payload.layerId : "";
    const params = isRecord5(payload.params) ? payload.params : {};
    if (!op || !layerId) {
      throw new Error("create-visualization requires an op and a layerId.");
    }
    const layer = await loadLayer(context, layerId);
    const resolvedOp = op === "renderer" ? resolveAutoRendererOp(layer, params) : op;
    let created;
    if (resolvedOp === "labeling") {
      created = await createLabeling(context, layer, params);
    } else if (resolvedOp === "popup_template") {
      created = createPopupTemplate(layer, params);
    } else {
      created = await createRendererVisualization(context, resolvedOp, layer, params);
    }
    return {
      status: "created",
      layerId,
      op: resolvedOp,
      properties: created.properties,
      evidence: created.evidence
    };
  }

  // src/frame/controller.ts
  var SDK_WIDGET_COMPONENTS = {
    legend: { tagName: "arcgis-legend", expandIcon: "legend", expandTooltip: "Legend" },
    layerList: { tagName: "arcgis-layer-list", expandIcon: "layers", expandTooltip: "Layers" },
    basemapGallery: {
      tagName: "arcgis-basemap-gallery",
      expandIcon: "basemap",
      expandTooltip: "Basemaps"
    },
    search: { tagName: "arcgis-search", expandIcon: "search", expandTooltip: "Search" },
    home: { tagName: "arcgis-home" },
    compass: { tagName: "arcgis-compass" },
    scaleBar: { tagName: "arcgis-scale-bar" },
    print: { tagName: "arcgis-print" }
  };
  var PANEL_WIDGET_TYPES = /* @__PURE__ */ new Set(["basemapGallery", "layerList"]);
  var GALLERY_WIDGET_TYPES = /* @__PURE__ */ new Set(["basemapGallery"]);
  var MAP_PRESENTATION_WIDGET_TYPES = /* @__PURE__ */ new Set([
    "compass",
    "home",
    "legend",
    "layerList",
    "basemapGallery"
  ]);
  var BEHAVIOR_INSTALL_TIMEOUT_MS = 3e4;
  var MAX_DEBUG_EVENTS = 200;
  var MAX_RESULT_EVENTS = 20;
  var MAX_OBJECT_ID_SUGGESTIONS = 20;
  var RESULT_LAYER_GEOMETRY_TYPES = /* @__PURE__ */ new Set(["point", "multipoint", "polyline", "polygon"]);
  function isGraphicLike(value) {
    return typeof (value == null ? void 0 : value.getObjectId) === "function";
  }
  var EMPTY_SCENE_GROUND = { layers: [] };
  var EMPTY_SELECTION = { ids: [], layerId: "", count: 0 };
  var AppRuntimeController = class {
    constructor(config, resources) {
      this.config = config;
      this.resources = resources;
      /**
       * Layers built by `materialize-layer` and not yet added to the map.
       *
       * `materialize-layer` and `add-layer` are two commands because the app document is written
       * between them, and the SDK has no way to rebuild a layer from an operational-layer document:
       * `Layer` carries `fromArcGISServerUrl` and `fromPortalItem`, not `fromJSON`. The instance the
       * first command already loaded is therefore kept here for the second one to add.
       */
      __publicField(this, "materializedLayers", /* @__PURE__ */ new Map());
      __publicField(this, "widgets", /* @__PURE__ */ new Map());
      __publicField(this, "liveBlocks");
      __publicField(this, "sourceLayerIds");
      /** Behaviors in install order. A failed one stays listed so inspection can say why. */
      __publicField(this, "behaviors", /* @__PURE__ */ new Map());
      __publicField(this, "mutationTail", Promise.resolve());
      /**
       * Tasks that outlived their timeout and have not settled. A timeout ends the command, not the
       * module: the task keeps the raw `map` and `view` it was handed, and whatever it changes afterwards
       * is written by the next capture, which a tool or a native control triggers on the task's behalf
       * after its own command already reported a failure. Every capture says so while one is running.
       */
      __publicField(this, "timedOutTasksRunning", 0);
      /**
       * Set by every navigation this runtime performs. A layer added before anything has moved the
       * camera is framed by the runtime itself; once a navigation has chosen a view, no add replaces it.
       */
      __publicField(this, "cameraMovedSinceMount", false);
      __publicField(this, "startupState", "constructed");
      __publicField(this, "startupFailure");
      __publicField(this, "status", "");
      __publicField(this, "generation", 0);
      /**
       * Differs on every boot. A tool that asked for a fresh realm compares it before and after, since
       * nothing else a realm reports tells a reloaded one from one that was left in place.
       */
      __publicField(this, "realmId", `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
      __publicField(this, "debugSequence", 0);
      __publicField(this, "debugEvents", []);
      /** Per result layer, the next object id to assign; never reset, so no batch repeats an id. */
      __publicField(this, "resultLayerObjectIdCounters", /* @__PURE__ */ new Map());
      /**
       * The org's basemap gallery, once fetched.
       *
       * Held so resolving a basemap by id does not refetch the gallery on every call, and so the
       * instance the gallery already loaded is the one assigned to the map. `list-basemaps` with
       * `refresh` clears it.
       */
      __publicField(this, "basemapCatalog", null);
      __publicField(this, "selection", { ...EMPTY_SELECTION });
      __publicField(this, "selectionFeatures", []);
      __publicField(this, "selectionHighlight", null);
      __publicField(this, "selectionHighlightGeneration", 0);
      __publicField(this, "selectionRevision", 0);
      __publicField(this, "activeLocation", null);
      __publicField(this, "activeGraphic", null);
      __publicField(this, "managedGraphicLayerIds", /* @__PURE__ */ new Set());
      __publicField(this, "pendingGraphicPersistence", /* @__PURE__ */ new Map());
      __publicField(this, "runtimeClickGeneration", 0);
      __publicField(this, "uiEventPublisher", null);
      __publicField(this, "hostActions", { attachSelection: false, spatialSuggestions: false });
      __publicField(this, "sketchSequence", 0);
      __publicField(this, "interactionListener", null);
      __publicField(this, "locationHoldController", null);
      __publicField(this, "suppressedLocationClick", null);
      __publicField(this, "nativeMapContents", null);
      __publicField(this, "nativeSelectionPopup", null);
      __publicField(this, "frameCleanupBound", false);
      /**
       * The live view's commands, one handler per entry of {@link MapViewCommands}. A handler takes
       * the command's own input and answers its own result, so the table is the only dispatch.
       */
      __publicField(this, "viewCommands", {
        "go-to-coordinates": async (input) => await this.goToCoordinates(input),
        "go-to-extent": async (input) => await this.goToExtent(input),
        "go-to-layer": async (input) => await this.goToLayer(input),
        "get-layer-schema": async (input) => ({
          schema: this.buildLayerSchema(this.requireLayer(input.layerId))
        }),
        "query-feature-count": async (input) => ({
          count: await this.queryFeatureCount(input.layerId, input.where)
        }),
        "query-features": async (input) => await this.queryFeatures(input),
        "query-aggregate-statistics": async (input) => await this.queryLayerAggregateStatistics(input),
        "get-selection": async () => ({ selection: this.selection }),
        "select-features": async (input) => ({
          selection: await this.selectFeatures(input.layerId, input.featureIds, input.mode)
        }),
        "clear-selection": async () => {
          const cleared = this.selection.count > 0;
          this.clearSelection();
          return { cleared };
        }
      });
      var _a, _b, _c;
      this.sourceLayerIds = collectLayerIds((_c = (_b = (_a = resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []);
      this.config.nova.ownedGraphicsLayerIds.forEach((layerId) => {
        this.managedGraphicLayerIds.add(layerId);
      });
      this.liveBlocks = new AppLiveBlockController(
        resources,
        async (moduleId) => await this.importModule(moduleId),
        (blockId, error) => this.recordDebugEvent("block", blockId, "failed", {
          error: sanitizeErrorMessage(error)
        }),
        (error) => this.recordDebugEvent("block", "view-watcher", "failed", {
          error: sanitizeErrorMessage(error)
        })
      );
    }
    async start() {
      this.recordDebugEvent("startup", "start", "started");
      try {
        this.captureFrameErrors();
        this.bindFrameCleanup();
        document.body.classList.toggle("app-map-presentation", this.isMapPresentation());
        this.positionMapPresentationControls();
        this.mountMapPresentationControls();
        this.bindViewClickDispatcher();
        if (this.isMapPresentation()) {
          this.hideApplicationChrome();
          await this.mountConfiguredWidgets();
          this.startupState = "ready";
          this.recordDebugEvent("startup", "start", "succeeded");
          return;
        }
        renderRegions(this.config);
        this.syncHeaderVisibility();
        void this.liveBlocks.bind(this.layoutBlocks());
        await this.mountConfiguredWidgets();
        this.startupState = "replaying";
        await this.installConfiguredBehaviors();
        this.startupState = "ready";
        this.recordDebugEvent("startup", "start", "succeeded");
      } catch (error) {
        this.startupFailure = error;
        this.startupState = "failed";
        this.recordDebugEvent("startup", "start", "failed", {
          error: sanitizeErrorMessage(error)
        });
        throw error;
      }
    }
    inspect() {
      var _a, _b, _c;
      const layers = flattenLayers((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []);
      const viewContext = this.inspectViewContext();
      return {
        kind: this.config.kind,
        presentationMode: this.config.nova.presentationMode,
        title: this.config.item.title,
        template: this.config.app.template,
        preset: this.config.app.preset,
        showHeader: this.config.app.showHeader,
        theme: this.config.app.theme,
        regions: Object.entries(this.config.app.layout).filter(([, region]) => region && !region.hidden).map(([name, region]) => {
          var _a2;
          return {
            name,
            blockIds: (_a2 = region == null ? void 0 : region.blocks.map((block) => block.id)) != null ? _a2 : []
          };
        }),
        widgets: [...this.widgets.keys()],
        layers: layers.map((layer) => {
          var _a2, _b2, _c2, _d, _e;
          return {
            id: layer.id,
            title: layer.title,
            type: layer.type,
            loaded: layer.loaded,
            visible: layer.visible !== false,
            opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
            ...typeof layer.url === "string" ? { url: layer.url } : {},
            // A feature layer's `url` is its service root; `layerId` names the sublayer under it.
            ...typeof layer.layerId === "number" ? { layerId: layer.layerId } : {},
            ...typeof ((_a2 = layer.portalItem) == null ? void 0 : _a2.id) === "string" ? { portalItemId: layer.portalItem.id } : {},
            ...typeof ((_c2 = (_b2 = layer.portalItem) == null ? void 0 : _b2.portal) == null ? void 0 : _c2.url) === "string" ? { portalUrl: layer.portalItem.portal.url } : {},
            graphicCount: (_d = layer.graphics) == null ? void 0 : _d.length,
            fields: (_e = layer.fields) == null ? void 0 : _e.flatMap(
              (field) => field.name ? [
                {
                  name: field.name,
                  ...field.alias ? { alias: field.alias } : {},
                  ...field.type ? { type: field.type } : {}
                }
              ] : []
            )
          };
        }),
        interactions: this.declaredInteractions().map((interaction) => ({
          id: interaction.id,
          trigger: interaction.trigger,
          ...interaction.action.type === "registered-action" ? { actionId: interaction.action.actionId } : { action: interaction.action.type },
          ...interaction.behaviorId ? { behaviorId: interaction.behaviorId } : {}
        })),
        behaviors: this.behaviorStates(),
        actionIds: this.activeActionIds(),
        liveBlocks: this.liveBlocks.diagnostics(),
        ...this.liveBlocks.activeFilters().length > 0 ? { filters: this.liveBlocks.activeFilters() } : {},
        startup: this.startupState,
        status: this.status || void 0,
        selection: this.selection,
        selectionRevision: this.selectionRevision,
        ...viewContext,
        generation: this.generation,
        realmId: this.realmId
      };
    }
    setUiEventPublisher(publisher, hostActions = {}) {
      this.uiEventPublisher = publisher;
      this.hostActions = {
        attachSelection: publisher !== null && hostActions.attachSelection === true,
        spatialSuggestions: publisher !== null && hostActions.spatialSuggestions === true
      };
    }
    /** Where the view settled once a navigation resolved, read back rather than echoed from the request. */
    settledViewState() {
      const { viewState } = this.inspectViewContext();
      return viewState ? { viewState } : {};
    }
    inspectViewContext() {
      if (this.config.map.type === "webscene") {
        const camera = serializeValue(this.resources.view.camera);
        return isRecord4(camera) ? { camera, viewState: { mode: "3d", camera } } : {};
      }
      const center = serializeValue(this.resources.view.center);
      const scale = this.resources.view.scale;
      if (!isRecord4(center) || typeof scale !== "number" || !Number.isFinite(scale)) {
        return {};
      }
      const extent = toExtent(serializeValue(this.resources.view.extent));
      const rotation = typeof this.resources.view.rotation === "number" ? this.resources.view.rotation : 0;
      const viewState = {
        mode: "2d",
        center,
        scale,
        rotation,
        ...extent ? { extent } : {}
      };
      return {
        viewState,
        camera: {
          position: { ...center, z: scale },
          heading: rotation,
          tilt: 0,
          roll: 0,
          fov: 0
        }
      };
    }
    async applyOperation(type, payload) {
      if (type === "inspect") {
        return this.inspect();
      }
      if (type === "capture-state") {
        return {
          inspection: this.inspect(),
          mapCapture: await this.captureMapDocument()
        };
      }
      if (type === "capture-image") {
        return await this.captureImage(payload);
      }
      if (type === "capture-page") {
        return {
          status: "unavailable",
          error: "An app cannot photograph the frame it runs in; the Preview host captures the page."
        };
      }
      if (type === "inspect-dom") {
        return this.inspectDom(payload);
      }
      if (type === "debug-runtime") {
        return this.readDebugRuntime(payload);
      }
      if (type === "list-basemaps") {
        return await this.listBasemaps(payload);
      }
      if (type === "set-selection-suggestions") {
        return this.setSelectionSuggestions(payload);
      }
      if (type === "persist-graphic-result") {
        return this.resolveGraphicPersistence(payload);
      }
      const startedAt = Date.now();
      this.recordDebugEvent("command", type, "started");
      return await this.enqueueMutation(async () => {
        var _a;
        if (this.startupFailure) {
          throw this.startupFailure;
        }
        try {
          const result = await this.applyMutation(type, payload);
          this.generation += 1;
          (_a = this.nativeMapContents) == null ? void 0 : _a.refresh();
          this.recordDebugEvent("command", type, "succeeded", {
            durationMs: Date.now() - startedAt
          });
          return result;
        } catch (error) {
          this.recordDebugEvent("command", type, "failed", {
            durationMs: Date.now() - startedAt,
            error: sanitizeErrorMessage(error)
          });
          throw error;
        }
      });
    }
    async applyMutation(type, payload) {
      switch (type) {
        case "set-title":
          return this.setTitle(payload);
        case "set-theme":
          return this.setTheme(payload);
        case "set-region":
          return await this.setRegion(payload);
        case "clear-region":
          return await this.clearRegion(payload);
        case "add-widget":
        case "update-widget":
          return await this.upsertWidget(payload);
        case "remove-widget":
          return this.removeWidget(payload);
        case "materialize-layer":
          return await this.materializeLayer(payload);
        case "materialize-graphics":
          return await this.materializeGraphics(payload);
        case "set-graphics":
          return await this.setGraphics(payload);
        case "set-ground":
          return await this.setGround(payload);
        case "set-basemap":
        case "add-layer":
        case "remove-layer":
        case "reorder-layer":
        case "set-renderer":
        case "set-popup":
        case "set-labeling":
        case "set-layer-visibility":
        case "set-layer-opacity":
        case "set-layer-filter":
        case "set-feature-reduction":
          return await this.updateMap(type, payload);
        case "install-behavior":
          return await this.installBehavior(payload);
        case "uninstall-behavior":
          return await this.uninstallBehavior(payload);
        case "run-task":
          return await this.runTask(payload);
        case "create-visualization":
          return await createLayerVisualization(this.visualizationContext(), payload);
        default:
          if (isMapViewCommandType(type)) {
            return await this.executeViewCommand(type, payload);
          }
          throw new Error(
            `This app's runtime does not support the "${String(type)}" command. It was built by an older version of Nova; reopen the output with open_output to refresh it.`
          );
      }
    }
    async enqueueMutation(operation) {
      const queued = this.mutationTail.then(operation, operation);
      this.mutationTail = queued.then(
        () => void 0,
        () => void 0
      );
      return await queued;
    }
    setTitle(payload) {
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!title) {
        throw new Error("set-title requires a title.");
      }
      const subtitle = typeof payload.subtitle === "string" ? payload.subtitle.trim() : void 0;
      this.config = {
        ...this.config,
        item: { title, ...subtitle ? { subtitle } : {} }
      };
      document.title = title;
      setText("app-title", title);
      setText("app-subtitle", subtitle != null ? subtitle : "");
      return { title, subtitle: subtitle != null ? subtitle : null };
    }
    setTheme(payload) {
      const mode = payload.mode === "dark" ? "dark" : payload.mode === "light" ? "light" : null;
      const accent = payload.accent === "coral" ? "coral" : payload.accent === "default" ? "default" : null;
      if (!mode || !accent) {
        throw new Error("set-theme requires a supported mode and accent.");
      }
      this.config.app.theme = { mode, accent };
      applyAppTheme(mode, accent);
      return { mode, accent };
    }
    async setRegion(payload) {
      var _a;
      const name = readRegionName(payload.region);
      const region = (_a = payload.regionConfig) != null ? _a : payload.value;
      if (name === "header" && typeof payload.showHeader === "boolean") {
        this.config.app.showHeader = payload.showHeader;
      }
      if (name === "header" && region === void 0) {
        this.syncHeaderVisibility();
        return {
          region: name,
          blockCount: 0,
          showHeader: this.config.app.showHeader,
          status: "succeeded",
          layoutApplied: true,
          reinstalledBehaviorIds: [],
          failedBehaviors: []
        };
      }
      if (!isAppRegion(region)) {
        throw new Error("set-region requires a regionConfig with one or more typed blocks.");
      }
      this.config.app.layout[name] = region;
      renderRegion(name, region);
      void this.liveBlocks.bind(this.layoutBlocks());
      this.syncHeaderVisibility();
      const reinstall = await this.reinstallMountedBehaviors();
      return {
        region: name,
        blockCount: region.blocks.length,
        showHeader: this.config.app.showHeader,
        ...reinstall
      };
    }
    async clearRegion(payload) {
      const name = readRegionName(payload.region);
      delete this.config.app.layout[name];
      renderRegion(name, void 0);
      void this.liveBlocks.bind(this.layoutBlocks());
      if (name === "header" && typeof payload.showHeader === "boolean") {
        this.config.app.showHeader = payload.showHeader;
      }
      this.syncHeaderVisibility();
      const reinstall = await this.reinstallMountedBehaviors();
      return {
        region: name,
        cleared: true,
        showHeader: this.config.app.showHeader,
        ...reinstall
      };
    }
    async upsertWidget(payload) {
      if (!isAppWidget(payload.widget)) {
        throw new Error("A widget requires an id and a supported widget type.");
      }
      const widget = payload.widget;
      this.removeWidget({ id: widget.id });
      await this.mountWidget(widget);
      const index = this.config.app.widgets.findIndex((configured) => configured.id === widget.id);
      if (index === -1) {
        this.config.app.widgets.push(widget);
      } else {
        this.config.app.widgets[index] = widget;
      }
      return { widgetId: widget.id };
    }
    removeWidget(payload) {
      var _a, _b;
      const id = typeof payload.id === "string" ? payload.id : typeof payload.widgetId === "string" ? payload.widgetId : "";
      if (!id) {
        throw new Error("remove-widget requires an id.");
      }
      const instance = this.widgets.get(id);
      if (instance) {
        (_b = (_a = this.resources.view.ui) == null ? void 0 : _a.remove) == null ? void 0 : _b.call(_a, instance);
        if (instance instanceof HTMLElement) {
          instance.remove();
        }
        this.widgets.delete(id);
      }
      this.config.app.widgets = this.config.app.widgets.filter((widget) => widget.id !== id);
      return { widgetId: id, removed: true };
    }
    async mountConfiguredWidgets() {
      for (const widget of this.config.app.widgets) {
        await this.mountWidget(widget);
      }
    }
    mountMapPresentationControls() {
      if (!this.isMapPresentation()) {
        return;
      }
      this.nativeMapContents = mountNativeMapContents(this.resources, {
        onMapDocumentChange: () => this.publishMapDocumentChanged(),
        ...this.uiEventPublisher ? {
          onAttachLayer: (layer) => {
            var _a;
            return (_a = this.uiEventPublisher) == null ? void 0 : _a.call(this, {
              type: "layer-action",
              action: "attach-to-chat",
              layer
            });
          }
        } : {}
      });
      this.nativeSelectionPopup = mountNativeSelectionDial(this.resources, {
        onSelectionPopupClose: () => this.clearSelection(),
        onMapDocumentChange: () => this.publishMapDocumentChanged(),
        onPersistGraphic: async (graphic) => await this.persistGraphic(graphic),
        ...this.hostActions.attachSelection ? {
          onAttachSelection: () => this.publishSelectionAction("attach-to-chat"),
          onAttachLocation: () => this.publishLocationAction("attach-to-chat"),
          onAttachGraphic: () => this.publishGraphicAction("attach-to-chat")
        } : {},
        ...this.hostActions.spatialSuggestions ? {
          onRequestSpatialSuggestions: () => this.publishSelectionAction("request-spatial-suggestions"),
          onRequestLocationSuggestions: () => this.publishLocationAction("request-spatial-suggestions"),
          onRequestGraphicSuggestions: () => this.publishGraphicAction("request-spatial-suggestions"),
          onSuggestionSelected: (suggestionId) => this.publishSuggestionSelected(suggestionId)
        } : {}
      });
    }
    positionMapPresentationControls() {
      if (!this.isMapPresentation()) {
        return;
      }
      ["zoom", "compass", "navigation-toggle"].forEach((control) => {
        var _a, _b;
        (_b = (_a = this.resources.view.ui) == null ? void 0 : _a.remove) == null ? void 0 : _b.call(_a, control);
      });
    }
    publishMapDocumentChanged() {
      var _a;
      this.generation += 1;
      (_a = this.uiEventPublisher) == null ? void 0 : _a.call(this, {
        type: "map-document-changed",
        generation: this.generation
      });
    }
    async persistGraphic(graphic) {
      if (!this.uiEventPublisher) {
        throw new Error("App Preview Graphic persistence is unavailable.");
      }
      const requestId = createRuntimeSnapshotId();
      const result = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingGraphicPersistence.delete(requestId);
          reject(new Error("App Preview Graphic persistence timed out."));
        }, 3e4);
        this.pendingGraphicPersistence.set(requestId, { resolve, reject, timeout });
      });
      this.uiEventPublisher({
        type: "graphic-persist-request",
        requestId,
        selectionRevision: this.selectionRevision,
        graphic
      });
      await result;
    }
    resolveGraphicPersistence(payload) {
      const result = readGraphicPersistenceResult(payload);
      const pending = this.pendingGraphicPersistence.get(result.requestId);
      if (!pending) {
        return { applied: false, reason: "unknown-request" };
      }
      clearTimeout(pending.timeout);
      this.pendingGraphicPersistence.delete(result.requestId);
      if (result.success) {
        pending.resolve();
      } else {
        pending.reject(new Error(result.error.message));
      }
      return { applied: true, requestId: result.requestId, success: result.success };
    }
    publishSelectionAction(action) {
      if (!this.uiEventPublisher || this.selection.count <= 0 || this.selectionRevision <= 0) {
        return;
      }
      this.uiEventPublisher({
        type: "selection-action",
        selectionRevision: this.selectionRevision,
        action
      });
    }
    publishSuggestionSelected(suggestionId) {
      if (!this.uiEventPublisher || this.selection.count <= 0 && !this.activeLocation && !this.activeGraphic || this.selectionRevision <= 0) {
        return;
      }
      this.uiEventPublisher({
        type: "suggestion-selected",
        selectionRevision: this.selectionRevision,
        suggestionId
      });
    }
    publishLocationAction(action) {
      if (!this.uiEventPublisher || !this.activeLocation || this.selectionRevision <= 0) {
        return;
      }
      this.uiEventPublisher({
        type: "location-action",
        selectionRevision: this.selectionRevision,
        action
      });
    }
    publishGraphicAction(action) {
      if (!this.uiEventPublisher || !this.activeGraphic || this.selectionRevision <= 0) {
        return;
      }
      this.uiEventPublisher({
        type: "graphic-action",
        selectionRevision: this.selectionRevision,
        action
      });
    }
    setSelectionSuggestions(payload) {
      var _a;
      const state = readSelectionSuggestionState(payload);
      if (state.selectionRevision !== this.selectionRevision || this.selection.count <= 0 && !this.activeLocation && !this.activeGraphic) {
        return { applied: false, reason: "stale-selection" };
      }
      (_a = this.nativeSelectionPopup) == null ? void 0 : _a.setSuggestions(state);
      return { applied: true, status: state.status, selectionRevision: state.selectionRevision };
    }
    bindFrameCleanup() {
      if (this.frameCleanupBound) {
        return;
      }
      this.frameCleanupBound = true;
      window.addEventListener("pagehide", () => this.disposeFrameRuntime(), { once: true });
    }
    disposeFrameRuntime() {
      var _a, _b, _c, _d, _e, _f;
      this.runtimeClickGeneration += 1;
      this.selectionHighlightGeneration += 1;
      for (const pending of this.pendingGraphicPersistence.values()) {
        clearTimeout(pending.timeout);
        pending.reject(
          new Error("The app runtime was disposed before Graphic persistence completed.")
        );
      }
      this.pendingGraphicPersistence.clear();
      (_b = (_a = this.interactionListener) == null ? void 0 : _a.remove) == null ? void 0 : _b.call(_a);
      this.interactionListener = null;
      (_c = this.locationHoldController) == null ? void 0 : _c.dispose();
      this.locationHoldController = null;
      try {
        (_d = this.selectionHighlight) == null ? void 0 : _d.remove();
      } finally {
        this.selectionHighlight = null;
        this.selection = { ...EMPTY_SELECTION };
        this.activeLocation = null;
        this.selectionFeatures = [];
        (_e = this.nativeMapContents) == null ? void 0 : _e.dispose();
        this.nativeMapContents = null;
        (_f = this.nativeSelectionPopup) == null ? void 0 : _f.dispose();
        this.nativeSelectionPopup = null;
        document.body.classList.remove("app-map-presentation");
        this.uiEventPublisher = null;
      }
    }
    async mountWidget(widget) {
      var _a, _b, _c, _d, _e;
      if (this.isMapPresentation() && MAP_PRESENTATION_WIDGET_TYPES.has(widget.type)) {
        return;
      }
      const component = SDK_WIDGET_COMPONENTS[widget.type];
      if (!component) {
        return;
      }
      const widgetElement = document.createElement(component.tagName);
      widgetElement.id = `app-widget-${widget.id}`;
      widgetElement.setAttribute("data-widget-type", widget.type);
      widgetElement.classList.add("app-sdk-widget");
      if (PANEL_WIDGET_TYPES.has(widget.type)) {
        widgetElement.classList.add("app-sdk-widget-panel");
      }
      if (GALLERY_WIDGET_TYPES.has(widget.type)) {
        widgetElement.classList.add("app-sdk-widget-gallery");
      }
      widgetElement.view = this.resources.view;
      Object.assign(widgetElement, widget.config);
      let host = widgetElement;
      if (component.expandIcon) {
        const expand = document.createElement("arcgis-expand");
        expand.id = `app-widget-host-${widget.id}`;
        expand.setAttribute("expand-icon", component.expandIcon);
        expand.setAttribute("expand-tooltip", (_b = (_a = component.expandTooltip) != null ? _a : widget.title) != null ? _b : widget.type);
        expand.classList.add("app-sdk-widget-host");
        expand.mode = "floating";
        if (PANEL_WIDGET_TYPES.has(widget.type)) {
          expand.classList.add("app-sdk-widget-host-panel");
        }
        expand.view = this.resources.view;
        expand.appendChild(widgetElement);
        host = expand;
      }
      (_e = (_c = this.resources.view.ui) == null ? void 0 : _c.add) == null ? void 0 : _e.call(_c, host, (_d = widget.slot) != null ? _d : "top-right");
      this.widgets.set(widget.id, host);
    }
    /** Every block in the current layout, in region order. */
    layoutBlocks() {
      return Object.values(this.config.app.layout).flatMap((region) => {
        var _a;
        return (_a = region == null ? void 0 : region.blocks) != null ? _a : [];
      });
    }
    isMapPresentation() {
      return this.config.nova.presentationMode === "map";
    }
    hideApplicationChrome() {
      ["header", "left", "right", "footer"].forEach((name) => {
        renderRegion(name, void 0);
      });
      const header = document.getElementById("app-header");
      if (header) {
        header.hidden = true;
      }
    }
    syncHeaderVisibility() {
      const header = document.getElementById("app-header");
      if (header) {
        const region = this.config.app.layout.header;
        header.hidden = !this.config.app.showHeader && (!region || region.hidden || region.blocks.length === 0);
      }
    }
    /**
     * The basemaps this org offers, in the shape the workbench map answers `get-basemap-options` in.
     *
     * The app map used to have no catalog at all: the adapter refused the question, so `set_basemap`
     * had nothing to match a name against and passed the raw name to the SDK. That is why "world
     * imagery" cleared the map — `Basemap.fromId` knows 24 ids, none of them that phrase, and it
     * reports an unknown id by returning `null`. A catalog is what lets a name mean the same thing
     * on both surfaces, and it comes from the same place on both: `Portal.fetchBasemaps()` against
     * the portal this Preview registered its credential with. The request carries that credential on
     * its own, so an org's private gallery answers here exactly as it does in the workbench.
     */
    async listBasemaps(payload) {
      var _a;
      if (payload.refresh === true) {
        this.basemapCatalog = null;
      }
      (_a = this.basemapCatalog) != null ? _a : this.basemapCatalog = await this.fetchBasemapCatalog();
      return {
        basemaps: this.basemapCatalog.map((entry) => entry.descriptor),
        ...this.resources.portalUrl ? { portalUrl: this.resources.portalUrl } : {}
      };
    }
    /**
     * The gallery, plus whatever the map is wearing now.
     *
     * The active basemap is prepended because it is addressable and frequently is not in the gallery
     * — an app whose document carries a hand-picked basemap would otherwise be unable to name the
     * one it is already showing. A basemap that fails to load stays out: a catalog entry that cannot
     * be assigned is worse than a shorter catalog, because the failure would surface one command later
     * as a blank map rather than here as a missing option. The active basemap is exempt from that,
     * since it is already on the map whether or not it loaded, and hiding it would make the basemap
     * the user is looking at the one id they cannot name.
     */
    async fetchBasemapCatalog() {
      var _a;
      const Portal = await this.importModule("esri/portal/Portal");
      const portal = new Portal(this.resources.portalUrl ? { url: this.resources.portalUrl } : {});
      await ((_a = portal.load) == null ? void 0 : _a.call(portal));
      const gallery = typeof portal.fetchBasemaps === "function" ? await portal.fetchBasemaps(void 0, {
        include3d: this.appDocumentOrigin() === "web-scene"
      }) : [];
      const loaded = await Promise.allSettled(gallery.map(async (basemap) => {
        var _a2;
        return await ((_a2 = basemap.load) == null ? void 0 : _a2.call(basemap));
      }));
      const usable = gallery.filter((_, index) => {
        var _a2;
        return ((_a2 = loaded[index]) == null ? void 0 : _a2.status) === "fulfilled";
      });
      const entries = [];
      const claimed = /* @__PURE__ */ new Set();
      const active = this.resources.map.basemap;
      for (const basemap of [...active ? [active] : [], ...usable]) {
        const descriptor = toBasemapCatalogDescriptor(basemap);
        if (!descriptor || claimed.has(descriptor.id.toLowerCase())) {
          continue;
        }
        claimed.add(descriptor.id.toLowerCase());
        entries.push({ descriptor, basemap });
      }
      return entries;
    }
    /**
     * Turns an id into a basemap, or refuses.
     *
     * Three sources in order, and a refusal rather than a fourth. The gallery instance is preferred
     * because it is already loaded and carries the org's own configuration of that basemap. A
     * built-in name is next: `Basemap.fromId` is the SDK's own membership test, and its `null` is
     * the answer this whole path exists to stop treating as a basemap. A portal item id is last,
     * because an id that looks like one is one — nothing else in this vocabulary is 32 hex
     * characters.
     *
     * Loading before returning is not politeness. An unassignable basemap otherwise reaches the map,
     * clears what was there, and reports success; the caller then learns about it from a blank map
     * on the next reload. A basemap that will not load is a failed command, and this is where that
     * is still true.
     */
    async resolveBasemapById(basemapId) {
      var _a, _b;
      const normalized = basemapId.trim().toLowerCase();
      const known = (_a = this.basemapCatalog) == null ? void 0 : _a.find(
        (entry) => entry.descriptor.id.toLowerCase() === normalized
      );
      if (known) {
        return known.basemap;
      }
      const Basemap = await this.importModule("esri/Basemap");
      if (!Basemap.fromId) {
        throw new Error("The ArcGIS Basemap module cannot resolve a basemap id.");
      }
      const builtIn = Basemap.fromId(basemapId.trim());
      if (builtIn) {
        return await loadResolvedBasemap(builtIn, basemapId);
      }
      if (isPortalItemId2(basemapId)) {
        return await loadResolvedBasemap(
          new Basemap({ portalItem: { id: basemapId.trim() } }),
          basemapId
        );
      }
      const offered = ((_b = this.basemapCatalog) != null ? _b : []).map((entry) => `"${entry.descriptor.title}" (${entry.descriptor.id})`).slice(0, 12).join(", ");
      throw new Error(
        `"${basemapId}" is not a basemap this app can resolve. ` + (offered ? `This org's basemap gallery offers ${offered}. ` : "") + `The ArcGIS SDK also resolves these ids on its own: ${describeBuiltInBasemapIds()}. A 32-character portal item id works too. Note that the SDK has no "world imagery" id — that basemap is "satellite", and the gallery item is usually titled "Imagery".`
      );
    }
    async updateMap(type, payload) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      const map = this.resources.map;
      if (type === "set-layer-visibility") {
        const layerIds = Array.isArray(payload.layerIds) ? payload.layerIds.filter(
          (value) => typeof value === "string" && value.length > 0
        ) : [];
        if (layerIds.length === 0 || typeof payload.visible !== "boolean") {
          throw new Error("set-layer-visibility requires layerIds and a visible flag.");
        }
        const applied = [];
        for (const id of layerIds) {
          const target = (_a = map.findLayerById) == null ? void 0 : _a.call(map, id);
          if (!target) {
            throw new Error(`The app map has no layer "${id}".`);
          }
          target.visible = payload.visible;
          applied.push(id);
        }
        return { applied: true, layerIds: applied, visible: payload.visible };
      }
      if (type === "set-basemap") {
        const basemapId = typeof payload.basemapId === "string" ? payload.basemapId.trim() : "";
        if (basemapId) {
          const basemap = await this.resolveBasemapById(basemapId);
          map.basemap = basemap;
          return { applied: true, basemapId, baseMap: serializeValue(map.basemap) };
        }
        const Basemap = await this.importModule("esri/Basemap");
        if (!Basemap.fromJSON) {
          throw new Error("The ArcGIS Basemap module is unavailable.");
        }
        map.basemap = Basemap.fromJSON(
          requireRecord(payload.basemap, "set-basemap requires native baseMap JSON."),
          { origin: this.appDocumentOrigin() }
        );
        return { applied: true, baseMap: serializeValue(map.basemap) };
      }
      if (type === "add-layer") {
        const layer2 = await this.resolveLayerForAdd(payload.layer);
        (_b = map.add) == null ? void 0 : _b.call(map, layer2);
        const layerId2 = (_c = layer2.id) != null ? _c : null;
        if (layerId2) {
          this.sourceLayerIds.add(layerId2);
        }
        const framed = payload.frameIfFirst === true && await this.frameFirstLayer(layer2);
        return { applied: true, layerId: layerId2, ...framed ? { framed: true } : {} };
      }
      if (type === "remove-layer") {
        const layerId2 = typeof payload.layerId === "string" ? payload.layerId : "";
        if (!layerId2) {
          throw new Error("remove-layer requires a layerId.");
        }
        const layer2 = (_d = map.findLayerById) == null ? void 0 : _d.call(map, layerId2);
        if (!layer2) {
          throw new Error(`The app map has no layer "${layerId2}".`);
        }
        if (!removeLayerByIdFromMap(map, layerId2)) {
          throw new Error(
            `The app map could not remove layer "${layerId2}" from its owning collection.`
          );
        }
        this.sourceLayerIds.delete(layerId2);
        return { applied: true, layerId: layerId2 };
      }
      if (type === "reorder-layer") {
        const layerId2 = typeof payload.layerId === "string" ? payload.layerId : "";
        const index = typeof payload.index === "number" ? payload.index : NaN;
        if (!layerId2 || !Number.isInteger(index) || index < 0) {
          throw new Error("reorder-layer requires a layerId and a non-negative index.");
        }
        const layer2 = (_e = map.findLayerById) == null ? void 0 : _e.call(map, layerId2);
        if (!layer2) {
          throw new Error(`The app map has no layer "${layerId2}".`);
        }
        if (!map.reorder) {
          throw new Error("The app map does not expose layer reordering.");
        }
        map.reorder(layer2, index);
        return { applied: true, layerId: layerId2, index };
      }
      const layerId = typeof payload.layerId === "string" ? payload.layerId : "";
      const layer = layerId ? (_f = map.findLayerById) == null ? void 0 : _f.call(map, layerId) : void 0;
      if (!layer) {
        throw new Error("The requested app map layer is unavailable.");
      }
      if (type === "set-layer-opacity") {
        const opacity = typeof payload.opacity === "number" ? payload.opacity : NaN;
        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
          throw new Error("set-layer-opacity requires an opacity between 0 and 1.");
        }
        layer.opacity = opacity;
        return { applied: true, layerId, opacity };
      }
      if (type === "set-layer-filter") {
        const where = payload.definitionExpression;
        if (where !== null && typeof where !== "string") {
          throw new Error(
            "set-layer-filter requires a definitionExpression string, or null to clear it."
          );
        }
        if (!("definitionExpression" in layer)) {
          throw new Error(`Layer "${layerId}" does not support a feature filter.`);
        }
        layer.definitionExpression = where != null ? where : void 0;
        return { applied: true, layerId, definitionExpression: where };
      }
      if (type === "set-feature-reduction") {
        const featureReduction = payload.featureReduction;
        if (featureReduction !== null && !isRecord4(featureReduction)) {
          throw new Error(
            "set-feature-reduction requires native featureReduction JSON, or null to clear it."
          );
        }
        if (!("featureReduction" in layer)) {
          throw new Error(`Layer "${layerId}" does not support feature reduction.`);
        }
        layer.featureReduction = featureReduction != null ? featureReduction : void 0;
        return { applied: true, layerId, featureReduction: featureReduction != null ? featureReduction : null };
      }
      if (type === "set-renderer") {
        const rendererJsonUtils = await this.importModule("esri/renderers/support/jsonUtils");
        if (!rendererJsonUtils.fromJSON) {
          throw new Error("The ArcGIS renderer JSON utility is unavailable.");
        }
        const rendererJson = requireRecord(
          payload.renderer,
          "set-renderer requires native renderer JSON."
        );
        const applied = rendererJsonUtils.fromJSON(rendererJson);
        const readBack = (_g = applied.toJSON) == null ? void 0 : _g.call(applied);
        if (readBack && droppedSymbolTypes(rendererJson, readBack).length > 0) {
          const previousRenderer = layer.renderer;
          layer.renderer = rendererJson;
          const autocast = (_i = (_h = layer.renderer) == null ? void 0 : _h.toJSON) == null ? void 0 : _i.call(_h);
          if (!autocast || collectSymbolTypes(autocast).length < collectSymbolTypes(rendererJson).length) {
            layer.renderer = previousRenderer;
            throw new Error(
              "The ArcGIS SDK could not read this renderer's symbol and dropped it, which would have left the layer undrawn. Write the symbol in the SDK constructor form: simple-marker { color, size, style, outline }, simple-line { color, width, style } or simple-fill { color, style, outline }, with colours as CSS strings or [r, g, b, a] and alpha 0–1."
            );
          }
        } else {
          layer.renderer = applied;
        }
      } else if (type === "set-popup") {
        const PopupTemplate = await this.importModule("esri/PopupTemplate");
        if (!PopupTemplate.fromJSON) {
          throw new Error("The ArcGIS PopupTemplate module is unavailable.");
        }
        const popup = requireRecord(payload.popup, "set-popup requires a popup template.");
        layer.popupTemplate = "content" in popup ? popup : PopupTemplate.fromJSON(popup, { origin: this.appDocumentOrigin() });
      } else if (type === "set-labeling") {
        const labeling = requireRecords(
          payload.labeling,
          "set-labeling requires native labelingInfo JSON."
        );
        const LabelClass = await this.importModule("esri/layers/support/LabelClass");
        if (!LabelClass.fromJSON) {
          throw new Error("The ArcGIS LabelClass module is unavailable.");
        }
        const labelClasses = labeling.map(
          (entry) => LabelClass.fromJSON(entry, { origin: this.appDocumentOrigin() })
        );
        const lostPlacement = labeling.findIndex(
          (entry, index) => {
            var _a2;
            return entry.labelPlacement != null && ((_a2 = labelClasses[index]) == null ? void 0 : _a2.labelPlacement) == null;
          }
        );
        if (lostPlacement !== -1) {
          throw new Error(
            `Label class ${lostPlacement} has labelPlacement "${String((_j = labeling[lostPlacement]) == null ? void 0 : _j.labelPlacement)}", which native labelingInfo JSON does not read. Use the Web Map value, such as "esriServerPointLabelPlacementAboveCenter".`
          );
        }
        layer.labelingInfo = labelClasses;
      }
      return { applied: true, layerId: layerId || null };
    }
    /**
     * The three things grounded cartography needs, gathered once.
     *
     * `importModule` rather than a static import: the SDK arrives through the frame's own loader, so
     * a creator module is fetched the same way every other ArcGIS module in this runtime is.
     */
    visualizationContext() {
      return {
        importModule: (moduleId) => this.importModule(moduleId),
        view: this.resources.view,
        findLayerById: (layerId) => {
          var _a, _b, _c, _d;
          return (_d = (_c = (_b = (_a = this.resources.map).findLayerById) == null ? void 0 : _b.call(_a, layerId)) != null ? _c : this.materializedLayers.get(layerId)) != null ? _d : null;
        }
      };
    }
    async materializeLayer(payload) {
      var _a;
      const layer = isRecord4(payload.layer) ? await this.loadLayer(payload.layer) : await this.createLayerFromSource(readLayerSource(payload));
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      if (title) {
        layer.title = title;
      }
      if (typeof payload.opacity === "number") {
        layer.opacity = payload.opacity;
      }
      await ((_a = layer.load) == null ? void 0 : _a.call(layer));
      const materializedId = typeof layer.id === "string" ? layer.id : null;
      if (materializedId) {
        this.materializedLayers.set(materializedId, layer);
      }
      const layerTitle = typeof layer.title === "string" ? layer.title : null;
      return {
        layerId: materializedId,
        title: layerTitle,
        // A memory-backed layer's own `toJSON()` carries no features, so the document an embedded
        // collection arrived as is what gets saved.
        layer: isEmbeddedFeatureCollection(payload.layer) ? { ...payload.layer, ...layerTitle ? { title: layerTitle } : {} } : serializeValue(layer)
      };
    }
    async materializeGraphics(payload) {
      const id = typeof payload.layerId === "string" ? payload.layerId.trim() : "";
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      const graphicsJson = requireRecords(
        payload.graphics,
        "materialize-graphics requires native Graphic JSON entries."
      );
      if (!id || !title) {
        throw new Error("materialize-graphics requires a layerId and title.");
      }
      const Graphic = await this.importModule("esri/Graphic");
      if (!Graphic.fromJSON) {
        throw new Error("The ArcGIS Graphic module is unavailable.");
      }
      const graphics = graphicsJson.map(
        (graphic) => serializeValue(readGraphic((json) => Graphic.fromJSON(json), graphic))
      );
      return { layerId: id, title, graphicCount: graphics.length, graphics };
    }
    async setGraphics(payload) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      const layerId = typeof payload.layerId === "string" ? payload.layerId.trim() : "";
      if (!layerId) {
        throw new Error("set-graphics requires a layerId.");
      }
      const layer = await this.loadLayer(payload.layer);
      const previous = (_b = (_a = this.resources.map).findLayerById) == null ? void 0 : _b.call(_a, layerId);
      const previousTopLevelIndex = previous ? (_h = (_g = (_d = (_c = this.resources.map.layers) == null ? void 0 : _c.indexOf) == null ? void 0 : _d.call(_c, previous)) != null ? _g : (_f = (_e = this.resources.map.layers) == null ? void 0 : _e.toArray) == null ? void 0 : _f.call(_e).indexOf(previous)) != null ? _h : -1 : -1;
      if (previous) {
        (_j = (_i = this.resources.map).remove) == null ? void 0 : _j.call(_i, previous);
      }
      (_l = (_k = this.resources.map).add) == null ? void 0 : _l.call(_k, layer, previousTopLevelIndex >= 0 ? previousTopLevelIndex : void 0);
      this.sourceLayerIds.add(layerId);
      this.managedGraphicLayerIds.add(layerId);
      return {
        applied: true,
        layerId,
        graphicCount: Array.isArray(payload.graphics) ? payload.graphics.length : void 0
      };
    }
    async setGround(payload) {
      if (this.config.map.type !== "webscene") {
        throw new Error("set-ground only supports app-private Web Scenes.");
      }
      const mode = payload.mode === "built-in" || payload.mode === "custom" || payload.mode === "none" ? payload.mode : null;
      if (!mode) {
        throw new Error('set-ground requires mode "built-in", "custom", or "none".');
      }
      if (mode === "none") {
        this.resources.map.ground = EMPTY_SCENE_GROUND;
        this.resources.builtInGroundId = void 0;
        return { applied: true, mode, groundId: null };
      }
      if (mode === "built-in") {
        const groundId = typeof payload.groundId === "string" ? payload.groundId.trim() : "";
        if (!groundId) {
          throw new Error('set-ground mode "built-in" requires a groundId.');
        }
        this.resources.map.ground = groundId;
        this.resources.builtInGroundId = groundId;
        return { applied: true, mode, groundId };
      }
      const ground = requireRecord(
        payload.ground,
        'set-ground mode "custom" requires native ground JSON.'
      );
      const Ground = await this.importModule("esri/Ground");
      if (Ground == null ? void 0 : Ground.fromJSON) {
        this.resources.map.ground = Ground.fromJSON(ground, { origin: "web-scene" });
      } else {
        this.resources.map.ground = ground;
      }
      this.resources.builtInGroundId = void 0;
      return { applied: true, mode, ground: serializeValue(this.resources.map.ground) };
    }
    async installBehavior(payload) {
      const record = readBehaviorRecord(payload.behavior);
      const timeoutMs = readScriptTimeout(payload.timeoutMs);
      const previous = this.behaviors.get(record.id);
      const eventsSince = this.debugSequence;
      const outcome = await this.activateBehavior(record, timeoutMs);
      if (outcome.status === "succeeded") {
        this.config.app.behaviors = [
          ...this.config.app.behaviors.filter((behavior) => behavior.id !== record.id),
          record
        ];
        return {
          execution: outcome.execution,
          behavior: this.behaviorState(record.id),
          unfilledMounts: outcome.unfilledMounts,
          addedLayerIds: outcome.addedLayerIds,
          events: this.debugEventsSince(eventsSince)
        };
      }
      let restoredPrevious = false;
      if ((previous == null ? void 0 : previous.status) === "active") {
        const restored = await this.activateBehavior(previous.record, BEHAVIOR_INSTALL_TIMEOUT_MS);
        restoredPrevious = restored.status === "succeeded";
      } else if (!previous) {
        this.behaviors.delete(record.id);
      }
      return {
        execution: outcome.execution,
        ...previous ? { restoredPrevious } : {},
        events: this.debugEventsSince(eventsSince)
      };
    }
    /**
     * What app code reported while one command ran: `app.reportError`, an uncaught frame error, a
     * failed block. Returned with the command's result so a verification that reads "0 features"
     * also reads why, in the same call, instead of reasoning from the count alone. The command's own
     * lifecycle events are left out; the caller holds that outcome already.
     */
    debugEventsSince(sequence) {
      return this.debugEvents.filter((event) => event.seq > sequence && event.phase !== "command").slice(-MAX_RESULT_EVENTS).map((event) => structuredClone(event));
    }
    async uninstallBehavior(payload) {
      const behaviorId = typeof payload.behaviorId === "string" ? payload.behaviorId.trim() : "";
      if (!behaviorId) {
        throw new Error("uninstall-behavior requires a behaviorId.");
      }
      const existed = this.behaviors.has(behaviorId);
      await this.deactivateBehavior(behaviorId);
      this.behaviors.delete(behaviorId);
      this.config.app.behaviors = this.config.app.behaviors.filter(
        (behavior) => behavior.id !== behaviorId
      );
      return { behaviorId, removed: existed };
    }
    /** A temporary module: it runs once against the live app, and everything it registers is disposed. */
    async runTask(payload) {
      const bundlePath = readWorkspaceModulePath(payload.bundlePath, "run-task");
      const approvedModulePaths = readApprovedScriptModulePaths(payload.modulePaths);
      const timeoutMs = readScriptTimeout(payload.timeoutMs);
      const taskName = typeof payload.taskName === "string" && payload.taskName ? payload.taskName : bundlePath;
      const transientLayerIds = payload.persistMap === true ? null : this.snapshotTopLevelLayerIds();
      const cleanupCallbacks = [];
      const localScope = { active: true, actions: /* @__PURE__ */ new Map() };
      const eventsSince = this.debugSequence;
      const execute = async () => {
        const module = await this.importWorkspaceModule(bundlePath);
        const entry = readModuleEntry(module, bundlePath);
        return await entry(
          this.createBehaviorContext({
            behaviorId: `task:${taskName}`,
            config: {},
            approvedModulePaths,
            cleanupCallbacks,
            scope: localScope,
            allowActiveActionInvocation: true,
            declaredMounts: null
          })
        );
      };
      let taskRunning = true;
      let countedAsTimedOut = false;
      const outcome = await runWithTimeout(
        () => execute().finally(() => {
          taskRunning = false;
          if (countedAsTimedOut) {
            this.timedOutTasksRunning -= 1;
          }
        }),
        timeoutMs
      );
      if (outcome.status === "timed-out" && taskRunning) {
        countedAsTimedOut = true;
        this.timedOutTasksRunning += 1;
      }
      let cleanupError;
      try {
        await this.runCleanupCallbacks(cleanupCallbacks);
      } catch (error) {
        cleanupError = error;
      } finally {
        localScope.active = false;
      }
      this.removeTransientTopLevelLayers(transientLayerIds);
      const execution = cleanupError ? {
        status: "failed",
        durationMs: outcome.durationMs,
        error: {
          code: "SCRIPT_RUNTIME_ERROR",
          message: `Task cleanup failed: ${sanitizeErrorMessage(cleanupError)}`
        }
      } : outcome.status === "succeeded" ? {
        status: "succeeded",
        durationMs: outcome.durationMs,
        result: toCloneSafeResult(outcome.result)
      } : outcome;
      return {
        execution,
        mapCapture: execution.status === "succeeded" && payload.persistMap === true ? await this.captureMapDocument() : {
          status: "not-attempted",
          reason: execution.status === "succeeded" ? "persistMap was false, so no map capture ran." : `Map capture requires a succeeded execution; received ${execution.status}.`
        },
        events: this.debugEventsSince(eventsSince)
      };
    }
    async executeViewCommand(type, payload) {
      const handler = this.viewCommands[type];
      return await handler(payload);
    }
    /**
     * Frame a layer that arrives on an empty map whose camera nothing has moved yet.
     *
     * Leaving this to the model made framing a coin flip: the add and the navigation were separate
     * decisions in separate calls, and measured runs left the map at its default extent for 6 to 150
     * seconds after the data had loaded. The camera move is started, not awaited, so the add does not
     * wait on an animation.
     */
    async frameFirstLayer(layer) {
      var _a, _b, _c;
      const map = this.resources.map;
      const goTo = this.resources.view.goTo;
      if (this.cameraMovedSinceMount || !goTo || ((_b = (_a = map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a).length) !== 1) {
        return false;
      }
      try {
        await ((_c = layer.load) == null ? void 0 : _c.call(layer));
      } catch {
        return false;
      }
      const extent = layer.fullExtent;
      if (!extent) {
        return false;
      }
      this.cameraMovedSinceMount = true;
      void Promise.resolve(goTo.call(this.resources.view, extent)).catch((error) => {
        reportError("framing the first layer failed", error);
      });
      return true;
    }
    async goToCoordinates(input) {
      this.cameraMovedSinceMount = true;
      const goTo = this.resources.view.goTo;
      if (!goTo) {
        throw new Error("The open app view cannot navigate.");
      }
      const point = await this.deserializeGeometry({
        x: input.longitude,
        y: input.latitude,
        ...input.altitude !== void 0 ? { z: input.altitude } : {},
        spatialReference: { wkid: 4326 }
      });
      await goTo.call(
        this.resources.view,
        input.scale !== void 0 ? { target: point, scale: input.scale } : point,
        {
          ...input.durationMs !== void 0 ? { duration: input.durationMs } : {}
        }
      );
      return {
        message: `Flew to ${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`,
        ...this.settledViewState()
      };
    }
    async goToExtent(input) {
      this.cameraMovedSinceMount = true;
      const goTo = this.resources.view.goTo;
      const extent = toExtent(input.extent);
      if (!extent) {
        throw new Error("go-to-extent requires an extent.");
      }
      if (!goTo) {
        throw new Error("The open app view cannot navigate.");
      }
      await goTo.call(
        this.resources.view,
        await this.deserializeGeometry(withGeographicDefault(extent)),
        {
          ...typeof input.durationMs === "number" ? { duration: input.durationMs } : {}
        }
      );
      return { message: "Extent updated", ...this.settledViewState() };
    }
    async goToLayer(input) {
      var _a, _b, _c;
      this.cameraMovedSinceMount = true;
      const layer = this.requireLayer(input.layerId);
      const target = (_c = layer.fullExtent) != null ? _c : typeof layer.queryExtent === "function" ? (await layer.queryExtent((_b = (_a = layer.createQuery) == null ? void 0 : _a.call(layer)) != null ? _b : {})).extent : void 0;
      if (!target) {
        throw new Error(`Layer has no extent to zoom to: ${input.layerId}`);
      }
      if (typeof this.resources.view.goTo !== "function") {
        throw new Error("The open app view cannot navigate.");
      }
      await this.resources.view.goTo(target, {
        ...input.durationMs !== void 0 ? { duration: input.durationMs } : {}
      });
      return {
        layerId: input.layerId,
        message: `Navigated to layer ${input.layerId}`,
        ...this.settledViewState()
      };
    }
    /**
     * One feature query, narrowed by a spatial filter when it carries one. An extent reaches the
     * service as the query geometry, the same way a geometry filter does.
     */
    async queryFeatures(input) {
      var _a;
      const { spatialFilter, ...query } = input;
      if ((spatialFilter == null ? void 0 : spatialFilter.kind) === "geometry") {
        return await this.queryLayerBySpatialFilter({
          ...query,
          geometry: await this.deserializeGeometry(spatialFilter.geometry),
          spatialRelationship: toServiceSpatialRelationship(spatialFilter.spatialRelationship)
        });
      }
      if ((spatialFilter == null ? void 0 : spatialFilter.kind) === "extent") {
        return await this.queryLayerBySpatialFilter({
          ...query,
          geometry: await this.deserializeGeometry(withGeographicDefault(spatialFilter.extent))
        });
      }
      return await this.queryLayerBySpatialFilter({ ...query, where: (_a = query.where) != null ? _a : "1=1" });
    }
    requireLayer(layerId) {
      var _a, _b, _c;
      const layer = findLayerById((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [], layerId);
      if (!layer) {
        throw new Error(`Layer not found: ${layerId}`);
      }
      return layer;
    }
    requireQueryableLayer(layerId) {
      const layer = this.requireLayer(layerId);
      if (!isQueryableLayer(layer)) {
        throw new Error(`Layer "${layerId}" does not support queries in the open app.`);
      }
      return layer;
    }
    buildLayerSchema(layer) {
      var _a, _b, _c, _d, _e, _f, _g;
      return {
        layerId: (_a = layer.id) != null ? _a : "",
        ...layer.geometryType ? { geometryType: layer.geometryType } : {},
        ...layer.objectIdField ? { objectIdField: layer.objectIdField } : {},
        ...layer.displayField ? { displayField: layer.displayField } : {},
        ...typeof ((_b = layer.spatialReference) == null ? void 0 : _b.wkid) === "number" ? { spatialReferenceWkid: layer.spatialReference.wkid } : {},
        ...toExtent(serializeValue(layer.fullExtent)) ? { extent: toExtent(serializeValue(layer.fullExtent)) } : {},
        ...layer.timeInfo || layer.dateFieldsTimeZone || typeof layer.datesInUnknownTimezone === "boolean" ? {
          timeInfo: {
            ...((_c = layer.timeInfo) == null ? void 0 : _c.startField) ? { startField: layer.timeInfo.startField } : {},
            ...((_d = layer.timeInfo) == null ? void 0 : _d.endField) ? { endField: layer.timeInfo.endField } : {},
            ...((_e = layer.timeInfo) == null ? void 0 : _e.trackIdField) ? { trackIdField: layer.timeInfo.trackIdField } : {},
            ...layer.dateFieldsTimeZone ? { timeZone: layer.dateFieldsTimeZone } : {},
            ...typeof layer.datesInUnknownTimezone === "boolean" ? { datesInUnknownTimezone: layer.datesInUnknownTimezone } : {},
            ...((_f = layer.timeInfo) == null ? void 0 : _f.fullTimeExtent) ? {
              fullTimeExtent: {
                ...layer.timeInfo.fullTimeExtent.start !== void 0 ? { start: toEpochMillis(layer.timeInfo.fullTimeExtent.start) } : {},
                ...layer.timeInfo.fullTimeExtent.end !== void 0 ? { end: toEpochMillis(layer.timeInfo.fullTimeExtent.end) } : {}
              }
            } : {}
          }
        } : {},
        fields: ((_g = layer.fields) != null ? _g : []).flatMap((field) => {
          var _a2, _b2;
          if (typeof field.name !== "string" || !field.name) {
            return [];
          }
          return [
            {
              name: field.name,
              ...field.alias ? { alias: field.alias } : {},
              type: (_a2 = field.type) != null ? _a2 : "unknown",
              ...typeof field.nullable === "boolean" ? { nullable: field.nullable } : {},
              ...((_b2 = field.domain) == null ? void 0 : _b2.type) ? {
                domain: {
                  type: field.domain.type,
                  ...field.domain.name ? { name: field.domain.name } : {},
                  ...field.domain.codedValues ? { codedValues: field.domain.codedValues } : {},
                  ...typeof field.domain.minValue === "number" ? { minValue: field.domain.minValue } : {},
                  ...typeof field.domain.maxValue === "number" ? { maxValue: field.domain.maxValue } : {}
                }
              } : {}
            }
          ];
        })
      };
    }
    createLayerQuery(layer, input) {
      var _a, _b;
      const query = (_b = (_a = layer.createQuery) == null ? void 0 : _a.call(layer)) != null ? _b : {};
      if (input.where) {
        query.where = input.where;
      }
      if (input.geometry) {
        query.geometry = input.geometry;
      }
      if (input.spatialRelationship) {
        query.spatialRelationship = input.spatialRelationship;
      }
      if (input.outFields) {
        query.outFields = input.outFields;
      }
      if (input.orderByFields) {
        query.orderByFields = input.orderByFields;
      }
      if (typeof input.limit === "number") {
        query.num = input.limit;
      }
      if (typeof input.returnGeometry === "boolean") {
        query.returnGeometry = input.returnGeometry;
      }
      return query;
    }
    async queryLayerBySpatialFilter(input) {
      var _a, _b, _c;
      const layer = this.requireQueryableLayer(input.layerId);
      const outputFormat = (_a = input.outputFormat) != null ? _a : "preview";
      const includeGeometry = outputFormat === "feature-collection" ? input.includeGeometry !== false : false;
      const featuresQuery = this.createLayerQuery(layer, {
        where: input.where,
        geometry: input.geometry,
        spatialRelationship: input.spatialRelationship,
        outFields: ((_b = input.outFields) == null ? void 0 : _b.length) ? input.outFields : ["*"],
        orderByFields: input.orderByFields,
        limit: input.limit,
        returnGeometry: includeGeometry
      });
      const countQuery = this.createLayerQuery(layer, {
        where: input.where,
        geometry: input.geometry,
        spatialRelationship: input.spatialRelationship,
        returnGeometry: false
      });
      const [featuresResult, count, extentResult] = await Promise.all([
        layer.queryFeatures(featuresQuery),
        this.executeLayerFeatureCount(layer, countQuery),
        input.includeExtent && layer.queryExtent ? layer.queryExtent(countQuery) : Promise.resolve(void 0)
      ]);
      const features = (_c = featuresResult.features) != null ? _c : [];
      if (outputFormat === "feature-collection") {
        return {
          featureCollection: toGeoprocessingFeatureCollection(
            layer,
            features,
            input.layerId,
            featuresResult.spatialReference
          ),
          count,
          ...toExtent(serializeValue(extentResult == null ? void 0 : extentResult.extent)) ? { matchedExtent: toExtent(serializeValue(extentResult == null ? void 0 : extentResult.extent)) } : {}
        };
      }
      return {
        features: features.map(
          (feature, index) => toQueryPreviewFeatureDescriptor(input.layerId, layer.objectIdField, feature, index)
        ),
        count,
        ...toExtent(serializeValue(extentResult == null ? void 0 : extentResult.extent)) ? { matchedExtent: toExtent(serializeValue(extentResult == null ? void 0 : extentResult.extent)) } : {}
      };
    }
    async queryFeatureCount(layerId, where) {
      const layer = this.requireQueryableLayer(layerId);
      return await this.executeLayerFeatureCount(
        layer,
        this.createLayerQuery(layer, {
          where,
          returnGeometry: false
        })
      );
    }
    async executeLayerFeatureCount(layer, query) {
      var _a, _b;
      if (typeof layer.queryFeatureCount === "function") {
        return await layer.queryFeatureCount(query);
      }
      return (_b = (_a = (await layer.queryFeatures(query)).features) == null ? void 0 : _a.length) != null ? _b : 0;
    }
    async queryLayerAggregateStatistics(input) {
      var _a, _b, _c, _d, _e, _f;
      const layer = this.requireQueryableLayer(input.layerId);
      const fields = /* @__PURE__ */ new Set();
      (_a = input.groupByFields) == null ? void 0 : _a.forEach((field) => fields.add(field));
      input.statistics.forEach((definition) => {
        if (definition.fieldName) {
          fields.add(definition.fieldName);
        }
      });
      const result = await layer.queryFeatures(
        this.createLayerQuery(layer, {
          where: input.where,
          outFields: fields.size > 0 ? [...fields] : ["*"],
          returnGeometry: false
        })
      );
      const grouped = /* @__PURE__ */ new Map();
      for (const feature of (_b = result.features) != null ? _b : []) {
        const attributes = (_c = feature.attributes) != null ? _c : {};
        const groupValues = ((_d = input.groupByFields) == null ? void 0 : _d.length) ? Object.fromEntries(
          input.groupByFields.map((field) => [
            field,
            normalizeAggregateGroupValue(attributes[field])
          ])
        ) : void 0;
        const key = JSON.stringify(groupValues != null ? groupValues : {});
        const existing = grouped.get(key);
        if (existing) {
          existing.records.push(attributes);
          continue;
        }
        grouped.set(key, { groupValues, records: [attributes] });
      }
      let rows = [...grouped.values()].map(({ groupValues, records }) => ({
        ...groupValues ? { groupValues } : {},
        statistics: Object.fromEntries(
          input.statistics.map((definition) => [
            definition.outStatisticFieldName,
            aggregateStatisticValue(records, definition)
          ])
        )
      }));
      if ((_e = input.orderByFields) == null ? void 0 : _e.length) {
        rows = sortAggregateRows(rows, input.orderByFields);
      }
      const limit = typeof input.limit === "number" ? Math.max(1, input.limit) : void 0;
      const truncated = limit !== void 0 && rows.length > limit;
      const limitedRows = limit !== void 0 ? rows.slice(0, limit) : rows;
      return {
        rows: limitedRows,
        returned: limitedRows.length,
        truncated,
        ...((_f = input.groupByFields) == null ? void 0 : _f.length) ? { groupByFields: input.groupByFields } : {},
        statisticFieldNames: input.statistics.map((definition) => definition.outStatisticFieldName)
      };
    }
    async selectFeatures(layerId, featureIds, mode) {
      this.runtimeClickGeneration += 1;
      this.requireLayer(layerId);
      const normalizedIds = [
        ...new Set(featureIds.map((featureId) => featureId.trim()).filter(Boolean))
      ];
      const currentIds = this.selection.layerId === layerId ? this.selection.ids : [];
      const nextIds = applySelectionMode(currentIds, normalizedIds, mode);
      const objectIds = nextIds.map((featureId) => toSelectionObjectId(layerId, featureId));
      const nextSelection = nextIds.length > 0 ? {
        layerId,
        ids: nextIds,
        count: nextIds.length
      } : { ...EMPTY_SELECTION };
      const nextFeatures = nextSelection.count > 0 ? await this.readSelectedFeatures(layerId, nextSelection.ids) : [];
      if (!await this.syncSelectionHighlight(layerId, objectIds)) {
        return this.selection;
      }
      this.commitSelection(nextSelection, nextFeatures);
      return this.selection;
    }
    async selectGraphicFeature(feature, hitLayer) {
      const layerInfo = hitLayer != null ? hitLayer : readGraphicLayerInfo(feature);
      const layerId = typeof (layerInfo == null ? void 0 : layerInfo.id) === "string" ? layerInfo.id : "";
      const objectIdField = typeof (layerInfo == null ? void 0 : layerInfo.objectIdField) === "string" ? layerInfo.objectIdField : void 0;
      if (!layerId) {
        throw new Error("The clicked feature has no selectable layer.");
      }
      this.requireLayer(layerId);
      const descriptor = toQueryFeatureDescriptor(
        layerId,
        objectIdField,
        {
          attributes: feature.attributes,
          geometry: isRecord4(feature.geometry) || typeof feature.geometry === "object" && feature.geometry !== null ? feature.geometry : void 0,
          getObjectId: feature.getObjectId
        },
        0
      );
      const nextSelection = {
        layerId,
        ids: [descriptor.featureId],
        count: 1
      };
      if (!await this.syncSelectionHighlight(layerId, feature)) {
        return void 0;
      }
      this.commitSelection(nextSelection, [descriptor], [feature]);
      return nextSelection;
    }
    clearSelection(options = {}) {
      var _a;
      this.activeGraphic = null;
      if (options.invalidatePendingClick !== false) {
        this.runtimeClickGeneration += 1;
      }
      this.selectionHighlightGeneration += 1;
      this.activeLocation = null;
      try {
        (_a = this.selectionHighlight) == null ? void 0 : _a.remove();
      } finally {
        this.selectionHighlight = null;
        this.commitSelection({ ...EMPTY_SELECTION }, []);
      }
    }
    commitSelection(selection, features, popupGraphics = [], anchor) {
      var _a, _b, _c;
      this.activeLocation = null;
      this.activeGraphic = null;
      this.selection = selection;
      this.selectionFeatures = features;
      this.selectionRevision += 1;
      if (selection.count > 0 && popupGraphics.length > 0) {
        (_a = this.nativeSelectionPopup) == null ? void 0 : _a.show({
          kind: "selection",
          features: popupGraphics,
          selectionCount: selection.count,
          ...anchor ? { anchor } : {}
        });
      } else {
        (_b = this.nativeSelectionPopup) == null ? void 0 : _b.clear();
      }
      (_c = this.uiEventPublisher) == null ? void 0 : _c.call(this, {
        type: "selection-changed",
        selectionRevision: this.selectionRevision,
        selection: structuredClone(selection)
      });
    }
    async commitManagedGraphicSelection(match, event, clickGeneration) {
      var _a, _b;
      const graphicJson = serializeValue(match.graphic);
      if (!isRecord4(graphicJson)) {
        throw new Error("The clicked managed Graphic could not be serialized.");
      }
      const graphicId = readOwnedGraphicId(graphicJson);
      const collectionId = readOwnedGraphicsCollectionId(match.layer.id);
      if (!graphicId || !collectionId) {
        throw new Error("The clicked managed Graphic has no persistent identity.");
      }
      const descriptor = toPersistentGraphicDescriptor(
        graphicJson,
        collectionId,
        typeof match.layer.title === "string" ? match.layer.title : collectionId,
        0
      );
      if (!await this.syncSelectionHighlight(match.layer.id, match.graphic)) {
        return void 0;
      }
      if (clickGeneration !== this.runtimeClickGeneration) {
        return void 0;
      }
      const summary = toPersistentGraphicSummaryDescriptor(descriptor);
      this.activeLocation = null;
      this.activeGraphic = summary;
      this.selection = { ...EMPTY_SELECTION };
      this.selectionFeatures = [];
      this.selectionRevision += 1;
      (_a = this.nativeSelectionPopup) == null ? void 0 : _a.show({
        kind: "graphic",
        feature: match.graphic,
        graphic: summary,
        ...readScreenAnchor(event) ? { anchor: readScreenAnchor(event) } : {}
      });
      (_b = this.uiEventPublisher) == null ? void 0 : _b.call(this, {
        type: "graphic-changed",
        selectionRevision: this.selectionRevision,
        graphic: summary
      });
      return this.selection;
    }
    async commitRuntimeClickSelection(clickSelection, event, clickGeneration) {
      const popupGraphics = await this.readRuntimePopupGraphics(clickSelection);
      if (clickGeneration !== this.runtimeClickGeneration) {
        return void 0;
      }
      const layer = this.requireLayer(clickSelection.layerId);
      const descriptors = popupGraphics.map(
        (graphic, index) => toQueryFeatureDescriptor(
          clickSelection.layerId,
          layer.objectIdField,
          {
            attributes: graphic.attributes,
            geometry: isRecord4(graphic.geometry) || typeof graphic.geometry === "object" && graphic.geometry !== null ? graphic.geometry : void 0,
            getObjectId: graphic.getObjectId
          },
          index
        )
      );
      if (!await this.syncSelectionHighlight(clickSelection.layerId, clickSelection.graphics)) {
        return void 0;
      }
      if (clickGeneration !== this.runtimeClickGeneration) {
        return void 0;
      }
      const selection = {
        layerId: clickSelection.layerId,
        ids: clickSelection.ids,
        count: clickSelection.ids.length
      };
      const anchor = readScreenAnchor(event);
      this.commitSelection(selection, descriptors, popupGraphics, anchor != null ? anchor : void 0);
      return selection;
    }
    async readRuntimePopupGraphics(clickSelection) {
      var _a, _b, _c;
      let layer;
      try {
        layer = this.requireQueryableLayer(clickSelection.layerId);
      } catch {
        return clickSelection.graphics;
      }
      try {
        const query = this.createLayerQuery(layer, {
          where: buildFeatureIdWhereClause(layer.objectIdField, clickSelection.ids),
          outFields: ["*"],
          returnGeometry: true
        });
        const result = await layer.queryFeatures(query);
        const queried = (_a = result.features) != null ? _a : [];
        if (queried.length === 0) {
          return clickSelection.graphics;
        }
        const popupTemplate = (_c = layer.popupTemplate) != null ? _c : (_b = layer.createPopupTemplate) == null ? void 0 : _b.call(layer);
        const byId = new Map(
          queried.map((graphic, index) => [
            resolveFeatureId(clickSelection.layerId, layer.objectIdField, graphic, index),
            graphic
          ])
        );
        return clickSelection.ids.map((featureId, index) => {
          var _a2, _b2;
          const graphic = (_a2 = byId.get(featureId)) != null ? _a2 : clickSelection.graphics[index];
          (_b2 = graphic.popupTemplate) != null ? _b2 : graphic.popupTemplate = popupTemplate;
          return graphic;
        });
      } catch (error) {
        this.recordDebugEvent("runtime", "selection-popup-hydration", "info", {
          error: sanitizeErrorMessage(error),
          layerId: clickSelection.layerId
        });
        return clickSelection.graphics;
      }
    }
    async syncSelectionHighlight(layerId, target) {
      const generation = ++this.selectionHighlightGeneration;
      const previousHighlight = this.selectionHighlight;
      if (Array.isArray(target) && target.length === 0) {
        try {
          previousHighlight == null ? void 0 : previousHighlight.remove();
        } finally {
          this.selectionHighlight = null;
        }
        return true;
      }
      if (typeof this.resources.view.whenLayerView !== "function") {
        try {
          previousHighlight == null ? void 0 : previousHighlight.remove();
        } finally {
          this.selectionHighlight = null;
        }
        return true;
      }
      const layer = this.requireLayer(layerId);
      const layerView = await this.resources.view.whenLayerView(layer);
      if (generation !== this.selectionHighlightGeneration) {
        return false;
      }
      if (typeof layerView.highlight !== "function") {
        try {
          previousHighlight == null ? void 0 : previousHighlight.remove();
        } finally {
          this.selectionHighlight = null;
        }
        this.recordDebugEvent("runtime", "selection-highlight", "info", {
          layerId,
          reason: "The layer view does not support highlighting; the selection is kept without one."
        });
        return true;
      }
      const handle = layerView.highlight(target);
      if (!handle || typeof handle.remove !== "function") {
        throw new Error(`Layer ${layerId} returned an invalid selection highlight handle.`);
      }
      if (generation !== this.selectionHighlightGeneration) {
        handle.remove();
        return false;
      }
      try {
        previousHighlight == null ? void 0 : previousHighlight.remove();
      } catch (error) {
        handle.remove();
        throw error;
      }
      this.selectionHighlight = handle;
      return true;
    }
    async readSelectedFeatures(layerId, featureIds) {
      var _a;
      const layer = this.requireQueryableLayer(layerId);
      const query = this.createLayerQuery(layer, {
        where: buildFeatureIdWhereClause(layer.objectIdField, featureIds),
        outFields: ["*"],
        returnGeometry: true
      });
      const result = await layer.queryFeatures(query);
      const descriptors = ((_a = result.features) != null ? _a : []).map(
        (feature, index) => toQueryFeatureDescriptor(layerId, layer.objectIdField, feature, index)
      );
      if (descriptors.length > 0) {
        return orderFeaturesByRequestedIds(descriptors, featureIds);
      }
      return descriptors;
    }
    async deserializeGeometry(geometry) {
      const json = requireRecord(geometry, "A valid geometry JSON object is required.");
      const jsonUtils = await this.importModule("esri/geometry/support/jsonUtils");
      if (typeof jsonUtils.fromJSON !== "function") {
        throw new Error("ArcGIS geometry JSON utilities are unavailable in the open app.");
      }
      return jsonUtils.fromJSON(json);
    }
    async unionGeometries(geometries) {
      const unionOperator = await this.importModule("esri/geometry/operators/unionOperator");
      if (typeof unionOperator.executeMany !== "function") {
        throw new Error("ArcGIS union operations are unavailable in the open app.");
      }
      return unionOperator.executeMany(
        await Promise.all(
          geometries.map(async (geometry) => await this.deserializeGeometry(geometry))
        )
      );
    }
    /**
     * Bind the one view listener every declared gesture dispatches through.
     *
     * Bound once and unconditionally, and the list is read on each click. A behavior installed after
     * startup adds interactions to a realm that is already running, and a listener bound only when the
     * boot-time list was non-empty never saw them.
     */
    bindViewClickDispatcher() {
      if (!this.resources.view.on || this.interactionListener) {
        return;
      }
      const handles = [];
      if (this.isMapPresentation()) {
        this.locationHoldController = createRuntimeLocationHoldController({
          onHold: async (point, isCurrent) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i;
            let hit;
            const operationalLayers = ((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []).filter(
              (layer) => layer.visible !== false
            );
            if (operationalLayers.length > 0) {
              if (!this.resources.view.hitTest) {
                return;
              }
              try {
                hit = await this.resources.view.hitTest(point, { include: operationalLayers });
              } catch (error) {
                reportError("resolving an empty-map location failed", error);
                return;
              }
            }
            if (!isCurrent()) {
              return;
            }
            const matches = (_e = (_d = hit == null ? void 0 : hit.results) == null ? void 0 : _d.flatMap((result) => {
              const match = readHitTestGraphicMatch(result);
              return match ? [match] : [];
            })) != null ? _e : [];
            if (matches.length > 0) {
              return;
            }
            const mapPoint = (_g = (_f = this.resources.view).toMap) == null ? void 0 : _g.call(_f, point);
            const location = readRuntimeMapLocation(mapPoint);
            if (!mapPoint || !location || !isCurrent()) {
              return;
            }
            this.clearSelection();
            this.activeLocation = location;
            this.suppressedLocationClick = point;
            (_h = this.nativeSelectionPopup) == null ? void 0 : _h.show({ kind: "location", anchor: point, mapPoint });
            (_i = this.uiEventPublisher) == null ? void 0 : _i.call(this, {
              type: "location-changed",
              selectionRevision: this.selectionRevision,
              location
            });
          }
        });
        handles.push(
          this.resources.view.on("pointer-down", (event) => {
            var _a;
            const input = readPointerInput(event);
            if (input) {
              (_a = this.locationHoldController) == null ? void 0 : _a.begin(input);
            }
          }),
          this.resources.view.on("pointer-move", (event) => {
            var _a;
            const input = readScreenAnchor(event);
            if (input) {
              (_a = this.locationHoldController) == null ? void 0 : _a.move(input);
            }
          }),
          this.resources.view.on("drag", (event) => {
            var _a;
            const input = readScreenAnchor(event);
            if (input) {
              (_a = this.locationHoldController) == null ? void 0 : _a.move(input);
            }
          }),
          this.resources.view.on("pointer-up", () => {
            var _a;
            return (_a = this.locationHoldController) == null ? void 0 : _a.end();
          })
        );
      }
      handles.push(
        this.resources.view.on("click", (event) => {
          void this.handleRuntimeMapClick(event);
        })
      );
      this.interactionListener = {
        remove: () => handles.forEach((handle) => {
          var _a;
          return (_a = handle.remove) == null ? void 0 : _a.call(handle);
        })
      };
    }
    async handleRuntimeMapClick(event) {
      var _a, _b, _c, _d;
      const clickPoint = readScreenAnchor(event);
      if (clickPoint && this.suppressedLocationClick && Math.hypot(
        clickPoint.x - this.suppressedLocationClick.x,
        clickPoint.y - this.suppressedLocationClick.y
      ) <= 5) {
        this.suppressedLocationClick = null;
        return;
      }
      this.suppressedLocationClick = null;
      const interactions = this.isMapPresentation() ? [] : this.declaredInteractions();
      const runtimeSelectionEnabled = this.isMapPresentation();
      if (!runtimeSelectionEnabled && interactions.length === 0) {
        return;
      }
      const featureInteractions = interactions.filter(
        (interaction) => interaction.trigger.type === "feature-click"
      );
      const clickGeneration = ++this.runtimeClickGeneration;
      let hitMatch;
      let hitError;
      let selection;
      let selectionError;
      let matches = [];
      let interactionHitMatch;
      if (runtimeSelectionEnabled || featureInteractions.length > 0) {
        try {
          const hit = await ((_b = (_a = this.resources.view).hitTest) == null ? void 0 : _b.call(_a, event));
          if (clickGeneration !== this.runtimeClickGeneration) {
            return;
          }
          matches = (_d = (_c = hit == null ? void 0 : hit.results) == null ? void 0 : _c.flatMap((result) => {
            const match = readHitTestGraphicMatch(result);
            return match ? [match] : [];
          })) != null ? _d : [];
        } catch (error) {
          hitError = error;
        }
      }
      if (!hitError) {
        interactionHitMatch = matches.find(
          (candidate) => featureInteractions.some(
            (interaction) => interaction.trigger.type === "feature-click" && interaction.trigger.layerId === candidate.layer.id
          )
        );
      }
      if (runtimeSelectionEnabled && !hitError) {
        const managedGraphicMatch = matches.find(
          (candidate) => this.managedGraphicLayerIds.has(candidate.layer.id) && readOwnedGraphicId(serializeValue(candidate.graphic))
        );
        if (managedGraphicMatch) {
          hitMatch = managedGraphicMatch;
          try {
            selection = await this.commitManagedGraphicSelection(
              managedGraphicMatch,
              event,
              clickGeneration
            );
          } catch (error) {
            selectionError = error;
          }
        } else {
          const clickSelection = selectRuntimeClickFeatures(matches);
          if (clickSelection) {
            hitMatch = clickSelection.matches[0];
            try {
              selection = await this.commitRuntimeClickSelection(
                clickSelection,
                event,
                clickGeneration
              );
            } catch (error) {
              selectionError = error;
            }
          } else {
            this.clearSelection({ invalidatePendingClick: false });
          }
        }
      } else if (!runtimeSelectionEnabled) {
        hitMatch = interactionHitMatch;
        if (hitMatch && !hitError) {
          try {
            selection = await this.selectGraphicFeature(hitMatch.graphic, hitMatch.layer);
          } catch (error) {
            selectionError = error;
          }
        }
      }
      for (const interaction of interactions) {
        const resolvedHitMatch = interaction.trigger.type === "feature-click" ? interactionHitMatch : hitMatch;
        const resolvedSelection = (resolvedHitMatch == null ? void 0 : resolvedHitMatch.layer.id) === (hitMatch == null ? void 0 : hitMatch.layer.id) ? selection : void 0;
        if (interaction.trigger.type === "feature-click") {
          if (hitError) {
            this.recordInteractionFailure(interaction, hitError);
            continue;
          }
          if (!resolvedHitMatch || resolvedHitMatch.layer.id !== interaction.trigger.layerId) {
            continue;
          }
          if (resolvedHitMatch.layer.id === (hitMatch == null ? void 0 : hitMatch.layer.id) && !resolvedSelection && !selectionError) {
            continue;
          }
          if (resolvedHitMatch.layer.id === (hitMatch == null ? void 0 : hitMatch.layer.id) && selectionError) {
            this.recordInteractionFailure(interaction, selectionError);
            continue;
          }
        }
        try {
          await this.handleMapClickInteraction(
            interaction,
            event,
            resolvedHitMatch,
            resolvedSelection
          );
        } catch (error) {
          this.recordInteractionFailure(interaction, error);
        }
      }
    }
    async handleMapClickInteraction(interaction, event, resolvedHit, resolvedSelection) {
      const hitMatch = resolvedHit;
      const graphic = hitMatch == null ? void 0 : hitMatch.graphic;
      let selection = resolvedSelection;
      if (interaction.trigger.type === "feature-click") {
        if (!graphic) {
          return null;
        }
        if (!selection) {
          selection = await this.selectGraphicFeature(graphic, hitMatch == null ? void 0 : hitMatch.layer);
          if (!selection) {
            return null;
          }
        }
      }
      this.recordDebugEvent("interaction", interaction.id, "info", {
        action: interaction.action.type,
        trigger: interaction.trigger.type,
        ...interaction.trigger.type === "feature-click" ? { layerId: interaction.trigger.layerId } : {}
      });
      if (interaction.action.type === "registered-action") {
        const actionResult = await this.invokeActiveProgramAction(
          interaction.action.actionId,
          {
            interactionId: interaction.id,
            trigger: interaction.trigger,
            event,
            ...graphic ? { graphic } : {},
            ...selection ? { selection } : {}
          },
          interaction.id
        );
        this.status = `Ran ${interaction.action.actionId} from ${interaction.id}.`;
        window.dispatchEvent(
          new CustomEvent("nova-app-interaction", {
            detail: {
              id: interaction.id,
              action: interaction.action,
              trigger: interaction.trigger,
              ...graphic ? { graphic } : {},
              ...selection ? { selection } : {}
            }
          })
        );
        return { interactionId: interaction.id, actionId: interaction.action.actionId, actionResult };
      } else {
        if (!graphic) {
          throw new Error(`Interaction "${interaction.id}" requires a clicked feature.`);
        }
        if (!selection) {
          selection = await this.selectGraphicFeature(graphic, hitMatch == null ? void 0 : hitMatch.layer);
          if (!selection) {
            return null;
          }
        }
        this.status = `Selected ${selection.count} feature from ${interaction.id}.`;
        window.dispatchEvent(
          new CustomEvent("nova-app-interaction", {
            detail: {
              id: interaction.id,
              action: interaction.action,
              trigger: interaction.trigger,
              graphic,
              selection: this.selection
            }
          })
        );
        return { interactionId: interaction.id, selection };
      }
    }
    recordInteractionFailure(interaction, error) {
      const message = sanitizeErrorMessage(error);
      if (interaction.action.type === "select-feature") {
        this.status = `Interaction "${interaction.id}" failed: ${message}`;
      }
      this.recordDebugEvent("interaction", interaction.id, "failed", {
        action: interaction.action.type,
        trigger: interaction.trigger.type,
        ...interaction.trigger.type === "feature-click" ? { layerId: interaction.trigger.layerId } : {},
        error: message
      });
    }
    /**
     * Builds one live layer from its operational-layer JSON through a temporary map document.
     *
     * `fromJSON` only stores the JSON: a Web Map or Web Scene does not read `layers` from it, and
     * creates them when the document loads. Reading `layers` before `load()` resolves always finds an
     * empty collection.
     */
    async loadLayer(value) {
      var _a, _b, _c, _d;
      if (this.config.map.type === "webscene" && isEmbeddedFeatureCollection(value)) {
        const layer2 = readEmbeddedFeatureCollectionLayer(
          await this.importModule("esri/layers/FeatureLayer"),
          value
        );
        await ((_a = layer2.load) == null ? void 0 : _a.call(layer2));
        return layer2;
      }
      const Document = await this.importModule(
        this.config.map.type === "webscene" ? "esri/WebScene" : "esri/WebMap"
      );
      if (!(Document == null ? void 0 : Document.fromJSON)) {
        throw new Error("The ArcGIS map document module is unavailable.");
      }
      const document2 = Document.fromJSON({
        version: this.config.map.type === "webscene" ? "1.39" : "2.36",
        operationalLayers: [value]
      });
      await ((_b = document2.load) == null ? void 0 : _b.call(document2));
      const layer = (_d = (_c = document2.layers) == null ? void 0 : _c.toArray) == null ? void 0 : _d.call(_c)[0];
      if (!layer) {
        throw new Error("The ArcGIS map document could not materialize the operational layer.");
      }
      return layer;
    }
    /**
     * Resolves the live layer an `add-layer` command should put on the map.
     *
     * A standalone `Layer` factory cannot hydrate every operational-layer shape. The first
     * `materialize-layer` command therefore builds the layer through its source or a temporary
     * WebMap/WebScene document and keeps that exact loaded instance for the subsequent add. A replay
     * without that instance can still rebuild URL- or portal-backed layers from their locator.
     */
    async resolveLayerForAdd(value) {
      var _a;
      const document2 = value && typeof value === "object" && !Array.isArray(value) ? value : null;
      if (!document2) {
        throw new Error("add-layer requires a native operational-layer document.");
      }
      const id = typeof document2.id === "string" ? document2.id : "";
      const materialized = id ? this.materializedLayers.get(id) : void 0;
      if (materialized) {
        this.materializedLayers.delete(id);
        return materialized;
      }
      const source = readOptionalLayerSource(document2);
      if (!source) {
        throw new Error(
          "This layer carries no service URL or portal item, so it cannot be rebuilt here. Reload the output with open_output to load it from the stored document."
        );
      }
      const layer = await this.createLayerFromSource(source);
      if (id) {
        layer.id = id;
      }
      if (typeof document2.title === "string") {
        layer.title = document2.title;
      }
      await ((_a = layer.load) == null ? void 0 : _a.call(layer));
      return layer;
    }
    appDocumentOrigin() {
      return this.config.map.type === "webscene" ? "web-scene" : "web-map";
    }
    async createLayerFromSource(source) {
      if ("url" in source) {
        const Layer2 = await this.importModule("esri/layers/Layer");
        if (!Layer2.fromArcGISServerUrl) {
          throw new Error("The ArcGIS Layer URL loader is unavailable.");
        }
        return await Layer2.fromArcGISServerUrl({ url: source.url });
      }
      if (source.layerId !== void 0) {
        const FeatureLayer = await this.importModule("esri/layers/FeatureLayer");
        return new FeatureLayer({ portalItem: { id: source.portalItemId }, layerId: source.layerId });
      }
      const Layer = await this.importModule("esri/layers/Layer");
      if (!Layer.fromPortalItem) {
        throw new Error("The ArcGIS portal item layer loader is unavailable.");
      }
      return await Layer.fromPortalItem({ portalItem: { id: source.portalItemId } });
    }
    /**
     * The one module gate for everything authored inside an app.
     *
     * Every app workspace module shares this loader and one answer about what an
     * app may import. Two modules are denied, `config` and
     * `identity/`, because the Preview holds the user's live credential and those
     * are where it is readable rather than merely spendable. `request` and
     * `portal/` were denied too and should not have been: they expose no token,
     * they are the SDK's own authenticated read paths, and denying them left raw
     * anonymous `fetch` as the only route.
     *
     * The gate lives in the runtime as well as preflight so a checked module id
     * cannot gain different authority when the committed program replays.
     */
    async importModule(moduleId) {
      if (!isSupportedArcgisModuleId(moduleId)) {
        throw new Error(
          "app.import accepts an ArcGIS SDK module id in esri/... or @arcgis/core/... .js form."
        );
      }
      if (isSensitiveArcgisModuleId(moduleId)) {
        throw new Error(
          `App code cannot import SDK identity or configuration authority: ${moduleId}. Those hold the token itself; esri/request, esri/portal/* and the service APIs already spend it for you.`
        );
      }
      const esmModuleId = toEsmModuleId(moduleId);
      const cached = this.resources.modules[esmModuleId];
      if (cached) {
        return cached;
      }
      if (!this.resources.moduleLoader) {
        throw new Error(`The private ArcGIS module loader is unavailable for "${moduleId}".`);
      }
      const loaded = await withModuleImportTimeout(this.resources.moduleLoader(moduleId), moduleId);
      this.resources.modules[esmModuleId] = loaded;
      return loaded;
    }
    /**
     * A pixel view of the app map.
     *
     * Structure tells you a renderer was assigned; it does not tell you the
     * symbols are visible, the labels legible, or the extent useful. The view's
     * own screenshot is the only evidence of those, and it stays inside the
     * Preview: no host DOM, no surrounding chrome, no page content.
     */
    async captureImage(payload) {
      var _a, _b;
      const view = this.resources.view;
      if (typeof view.takeScreenshot !== "function") {
        return {
          status: "unavailable",
          error: "The app view does not support screenshot capture."
        };
      }
      const width = typeof payload.width === "number" && Number.isFinite(payload.width) ? Math.min(Math.max(Math.round(payload.width), 240), 1600) : 900;
      const height = typeof payload.height === "number" && Number.isFinite(payload.height) ? Math.min(Math.max(Math.round(payload.height), 160), 1600) : void 0;
      try {
        const screenshot = await view.takeScreenshot({
          format: "png",
          width,
          ...height === void 0 ? {} : { height }
        });
        if (typeof screenshot.dataUrl !== "string" || !screenshot.dataUrl.startsWith("data:image/png;base64,")) {
          return { status: "failed", error: "The app returned no PNG screenshot." };
        }
        return {
          status: "captured",
          mimeType: "image/png",
          dataUrl: screenshot.dataUrl,
          ...typeof ((_a = screenshot.data) == null ? void 0 : _a.width) === "number" ? { width: screenshot.data.width } : {},
          ...typeof ((_b = screenshot.data) == null ? void 0 : _b.height) === "number" ? { height: screenshot.data.height } : {}
        };
      } catch (error) {
        return { status: "failed", error: sanitizeErrorMessage(error) };
      }
    }
    async captureMapDocument() {
      var _a, _b, _c;
      const { map, view } = this.resources;
      if (!map.updateFrom || !map.toJSON) {
        return {
          status: "failed",
          error: "The Preview map does not support native Web Map/Web Scene capture."
        };
      }
      try {
        await map.updateFrom(view);
        const behaviorOwnedLayerIds = this.activeBehaviorOwnedLayerIds();
        const liveLayers = (_c = (_b = (_a = map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : [];
        const writeMessages = [];
        const serialized = withoutOperationalLayers(
          map.toJSON({ messages: writeMessages }),
          behaviorOwnedLayerIds
        );
        const capturedGraphics = withGraphicsLayerCollections(
          serialized,
          liveLayers,
          behaviorOwnedLayerIds
        );
        const capturedDocument = this.config.map.type === "webscene" ? withSceneFeatureCollections(capturedGraphics, liveLayers, behaviorOwnedLayerIds) : capturedGraphics;
        const publicationWarnings = [];
        const document2 = mergeCapturedDisplayProperties(
          sanitizeCapturedAppMapDocument(capturedDocument),
          liveLayers
        );
        if (this.timedOutTasksRunning > 0) {
          publicationWarnings.push(
            "A map script that timed out is still running in the app, so this capture may include changes it made after its command reported the timeout. Check the map before relying on it."
          );
        }
        publicationWarnings.push(
          ...describeUnwrittenValues(writeMessages, collectLayerIds(liveLayers))
        );
        publicationWarnings.push(
          ...describeUncapturedLiveContent(
            document2,
            liveLayers,
            behaviorOwnedLayerIds,
            view
          )
        );
        if (this.config.map.type === "webscene" && this.resources.builtInGroundId) {
          const ground = isRecord4(document2.ground) ? document2.ground : { layers: [] };
          document2.ground = { ...ground, groundId: this.resources.builtInGroundId };
        }
        return {
          status: "captured",
          capture: {
            mapType: this.config.map.type,
            document: document2,
            ...publicationWarnings.length > 0 ? { publicationWarnings } : {}
          }
        };
      } catch (error) {
        return {
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    /** Replays every recorded behavior in order. One that fails is reported and does not stop the rest. */
    async installConfiguredBehaviors() {
      var _a;
      for (const record of this.config.app.behaviors) {
        const outcome = await this.activateBehavior(record, BEHAVIOR_INSTALL_TIMEOUT_MS);
        this.recordDebugEvent(
          "runtime",
          "install-behavior",
          outcome.status === "succeeded" ? "succeeded" : "failed",
          {
            behaviorId: record.id,
            durationMs: outcome.execution.durationMs,
            ...outcome.status === "succeeded" ? {} : { error: (_a = outcome.execution.error) == null ? void 0 : _a.message }
          }
        );
      }
    }
    /**
     * Re-runs the behaviors that render into mounts after the layout was re-rendered.
     *
     * Rendering a region replaces its elements, so a mount a behavior filled is an empty element again.
     * Reinstalling is the only way to repopulate it without asking each behavior for a redraw API.
     */
    async reinstallMountedBehaviors() {
      var _a, _b, _c, _d;
      const reinstalledBehaviorIds = [];
      const failedBehaviors = [];
      for (const behavior of [...this.behaviors.values()]) {
        if (behavior.status !== "active" || behavior.record.mounts.length === 0) {
          continue;
        }
        const outcome = await this.activateBehavior(behavior.record, BEHAVIOR_INSTALL_TIMEOUT_MS);
        if (outcome.status === "succeeded") {
          reinstalledBehaviorIds.push(behavior.record.id);
        } else {
          failedBehaviors.push({
            id: behavior.record.id,
            code: (_b = (_a = outcome.execution.error) == null ? void 0 : _a.code) != null ? _b : "SCRIPT_RUNTIME_ERROR",
            message: (_d = (_c = outcome.execution.error) == null ? void 0 : _c.message) != null ? _d : "The behavior failed to reinstall."
          });
        }
      }
      return {
        status: failedBehaviors.length > 0 ? "partial" : "succeeded",
        layoutApplied: true,
        reinstalledBehaviorIds,
        failedBehaviors
      };
    }
    async activateBehavior(record, timeoutMs) {
      var _a, _b, _c;
      await this.deactivateBehavior(record.id);
      const approvedModulePaths = readApprovedScriptModulePaths(record.modulePaths);
      const cleanupCallbacks = [];
      const scope = { active: true, actions: /* @__PURE__ */ new Map() };
      const layerIdsBefore = this.snapshotTopLevelLayerIds();
      const runtime = {
        record,
        scope,
        ownedLayerIds: /* @__PURE__ */ new Set(),
        cleanup: null,
        status: "failed"
      };
      this.behaviors.set(record.id, runtime);
      const install = async () => {
        const module = await this.importWorkspaceModule(record.bundlePath);
        const entry = readModuleEntry(module, record.bundlePath);
        return await entry(
          this.createBehaviorContext({
            behaviorId: record.id,
            config: record.config,
            approvedModulePaths,
            cleanupCallbacks,
            scope,
            allowActiveActionInvocation: false,
            declaredMounts: new Set(record.mounts)
          })
        );
      };
      const outcome = await runWithTimeout(install, timeoutMs);
      const addedLayerIds = [...this.snapshotTopLevelLayerIds()].filter(
        (id) => !layerIdsBefore.has(id)
      );
      let failure2 = outcome.status === "succeeded" ? null : (_b = (_a = outcome.error) == null ? void 0 : _a.message) != null ? _b : "The behavior failed to install.";
      if (!failure2) {
        const missingActions = record.interactions.map((interaction) => interaction.actionId).filter((actionId) => !scope.actions.has(actionId));
        if (missingActions.length > 0) {
          failure2 = `The behavior declares interactions for ${missingActions.map((id) => `"${id}"`).join(", ")} but registered ${[...scope.actions.keys()].map((id) => `"${id}"`).join(", ") || "no actions"}. Register each interaction action with app.actions.register during install.`;
        }
      }
      if (failure2) {
        try {
          await this.runCleanupCallbacks(cleanupCallbacks);
        } catch (cleanupError) {
          this.recordDebugEvent("runtime", "cleanup-behavior", "failed", {
            behaviorId: record.id,
            error: sanitizeErrorMessage(cleanupError)
          });
        } finally {
          scope.active = false;
        }
        this.removeLayersById(addedLayerIds);
        runtime.status = "failed";
        runtime.error = failure2;
        this.status = `Behavior "${record.id}" failed: ${failure2}`;
        return {
          status: "failed",
          execution: {
            status: outcome.status === "timed-out" ? "timed-out" : "failed",
            durationMs: outcome.durationMs,
            error: outcome.status === "succeeded" ? { code: "SCRIPT_RUNTIME_ERROR", message: failure2 } : (_c = outcome.error) != null ? _c : { code: "SCRIPT_RUNTIME_ERROR", message: failure2 }
          },
          unfilledMounts: [],
          addedLayerIds: []
        };
      }
      const returnedCleanup = readReturnedCleanup(
        outcome.status === "succeeded" ? outcome.result : void 0
      );
      runtime.cleanup = async () => {
        try {
          await this.runCleanupCallbacks(cleanupCallbacks, returnedCleanup);
        } finally {
          scope.active = false;
        }
      };
      addedLayerIds.forEach((id) => runtime.ownedLayerIds.add(id));
      record.ownedLayerIds.forEach((id) => runtime.ownedLayerIds.add(id));
      runtime.status = "active";
      delete runtime.error;
      return {
        status: "succeeded",
        execution: {
          status: "succeeded",
          durationMs: outcome.durationMs,
          result: toCloneSafeResult(outcome.status === "succeeded" ? outcome.result : void 0)
        },
        unfilledMounts: record.mounts.filter((mountId) => {
          const mount = this.findMountElement(mountId);
          return !mount || mount.childNodes.length === 0;
        }),
        addedLayerIds
      };
    }
    async deactivateBehavior(behaviorId) {
      var _a;
      const behavior = this.behaviors.get(behaviorId);
      if (!behavior) {
        return;
      }
      const cleanup = behavior.cleanup;
      behavior.cleanup = null;
      if (!cleanup) {
        behavior.scope.active = false;
      } else {
        try {
          await cleanup();
        } catch (error) {
          this.recordDebugEvent("runtime", "cleanup-behavior", "failed", {
            behaviorId,
            error: sanitizeErrorMessage(error)
          });
        }
      }
      this.removeLayersById([...behavior.ownedLayerIds]);
      for (const mountId of behavior.record.mounts) {
        (_a = this.findMountElement(mountId)) == null ? void 0 : _a.replaceChildren();
      }
    }
    behaviorState(behaviorId) {
      const behavior = this.behaviors.get(behaviorId);
      if (!behavior) {
        return null;
      }
      return {
        id: behavior.record.id,
        status: behavior.status,
        bundlePath: behavior.record.bundlePath,
        actionIds: [...behavior.scope.actions.keys()].sort(),
        ...behavior.error ? { error: behavior.error } : {}
      };
    }
    behaviorStates() {
      return [...this.behaviors.keys()].flatMap((id) => {
        const state = this.behaviorState(id);
        return state ? [state] : [];
      });
    }
    activeActionIds() {
      return [
        ...new Set(
          [...this.behaviors.values()].filter((behavior) => behavior.status === "active" && behavior.scope.active).flatMap((behavior) => [...behavior.scope.actions.keys()])
        )
      ].sort();
    }
    /** Interactions from app.json and from every recorded behavior, in one dispatch list. */
    declaredInteractions() {
      return [
        ...this.config.app.interactions,
        ...this.config.app.behaviors.flatMap(
          (behavior) => behavior.interactions.map((interaction) => ({
            id: interaction.id,
            trigger: interaction.trigger,
            action: { type: "registered-action", actionId: interaction.actionId },
            behaviorId: behavior.id
          }))
        )
      ];
    }
    removeLayersById(layerIds) {
      var _a, _b, _c, _d;
      for (const layerId of layerIds) {
        const layer = (_b = (_a = this.resources.map).findLayerById) == null ? void 0 : _b.call(_a, layerId);
        if (layer) {
          (_d = (_c = this.resources.map).remove) == null ? void 0 : _d.call(_c, layer);
        }
      }
    }
    snapshotTopLevelLayerIds() {
      var _a, _b, _c;
      return new Set(
        ((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []).map((layer) => layer.id).filter((id) => typeof id === "string" && id.length > 0)
      );
    }
    /**
     * Runtime-owned result layers are omitted from map capture because behavior replay rebuilds them.
     * Ownership stays on each active behavior so replacement and uninstall can remove the same layers.
     */
    activeBehaviorOwnedLayerIds() {
      return new Set(
        [...this.behaviors.values()].filter((behavior) => behavior.status === "active").flatMap((behavior) => [...behavior.ownedLayerIds])
      );
    }
    removeTransientTopLevelLayers(previousLayerIds) {
      var _a, _b, _c, _d, _e;
      if (!previousLayerIds) {
        return;
      }
      for (const layer of (_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []) {
        if (typeof layer.id === "string" && !previousLayerIds.has(layer.id)) {
          (_e = (_d = this.resources.map).remove) == null ? void 0 : _e.call(_d, layer);
        }
      }
    }
    findMountElement(blockId) {
      const escapedId = escapeSelector(blockId);
      return document.querySelector(
        `#app-mount-${cssIdentifier(blockId)}, [data-app-mount="${escapedId}"]`
      );
    }
    async requireObjectLayer(layerId) {
      var _a, _b, _c, _d;
      const layers = flattenLayers((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []);
      const matches = layers.filter((layer2) => layer2.id === layerId);
      if (matches.length === 0) {
        const availableLayerIds = layers.filter(
          (layer2) => {
            var _a2;
            return isQueryableLayer(layer2) && !this.managedGraphicLayerIds.has((_a2 = layer2.id) != null ? _a2 : "");
          }
        ).flatMap((layer2) => typeof layer2.id === "string" ? [layer2.id] : []);
        throw new Error(
          `Layer "${layerId}" is not in this output. ${describeAvailableIds("queryable layer", availableLayerIds)}`
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `Layer id "${layerId}" matches more than one live layer, so its object identity is ambiguous.`
        );
      }
      const layer = matches[0];
      await ((_d = layer.load) == null ? void 0 : _d.call(layer));
      if (!isQueryableLayer(layer)) {
        throw new Error(`Layer "${layerId}" does not support feature queries.`);
      }
      return layer;
    }
    async readAvailableFeatureIds(layer) {
      var _a, _b;
      try {
        const query = layer.createQuery();
        query.outFields = [(_a = layer.objectIdField) != null ? _a : "*"];
        query.returnGeometry = false;
        query.num = MAX_OBJECT_ID_SUGGESTIONS + 1;
        const result = await layer.queryFeatures(query);
        return ((_b = result.features) != null ? _b : []).flatMap((feature) => {
          const objectId = readExactFeatureObjectId(layer.objectIdField, feature);
          return objectId === null ? [] : [objectId];
        });
      } catch {
        return null;
      }
    }
    async getFeatureObjects(layerIdValue, featureIdsValue) {
      var _a, _b, _c;
      const layerId = readObjectIdentity(layerIdValue, "layerId");
      const requestedIds = readFeatureIdentities(featureIdsValue);
      const featureIds = requestedIds.map(String);
      const layer = await this.requireObjectLayer(layerId);
      const query = layer.createQuery();
      const objectIdType = (_b = (_a = layer.fields) == null ? void 0 : _a.find((field) => field.name === layer.objectIdField)) == null ? void 0 : _b.type;
      const numericObjectIds = ["oid", "integer", "small-integer", "big-integer"].includes(
        objectIdType != null ? objectIdType : ""
      );
      query.objectIds = requestedIds.map((id) => {
        if (numericObjectIds && typeof id === "string") {
          const numericId = Number(id);
          if (Number.isSafeInteger(numericId) && String(numericId) === id) {
            return numericId;
          }
        }
        return id;
      });
      query.where = "1=1";
      query.outFields = ["*"];
      query.returnGeometry = true;
      const result = await layer.queryFeatures(query);
      const byObjectId = /* @__PURE__ */ new Map();
      for (const graphic of (_c = result.features) != null ? _c : []) {
        const objectId = readExactFeatureObjectId(layer.objectIdField, graphic);
        if (objectId === null || !featureIds.includes(objectId)) {
          continue;
        }
        if (byObjectId.has(objectId)) {
          throw new Error(`Feature id "${objectId}" is ambiguous in layer "${layerId}".`);
        }
        byObjectId.set(objectId, graphic);
      }
      const missingFeatureIds = featureIds.filter((featureId) => !byObjectId.has(featureId));
      if (missingFeatureIds.length > 0) {
        const availableFeatureIds = await this.readAvailableFeatureIds(layer);
        const missingDescription = missingFeatureIds.length === 1 ? `Feature id ${quoteValue(missingFeatureIds[0])}` : `Feature ids ${quoteValues(missingFeatureIds)}`;
        throw new Error(
          `${missingDescription} ${missingFeatureIds.length === 1 ? "was" : "were"} not found in layer "${layerId}". ${availableFeatureIds === null ? "Available feature IDs could not be read." : describeAvailableIds("feature", availableFeatureIds)}`
        );
      }
      return featureIds.map((featureId) => byObjectId.get(featureId));
    }
    async getPersistentGraphics(graphicIdsValue) {
      var _a, _b, _c, _d, _e, _f;
      if (!Array.isArray(graphicIdsValue)) {
        throw new Error("graphicIds must be an array.");
      }
      const graphicIds = graphicIdsValue.map(
        (graphicId) => readObjectIdentity(graphicId, "graphicId")
      );
      if (new Set(graphicIds).size !== graphicIds.length) {
        throw new Error("Persistent Graphic lookup requires unique graphic ids.");
      }
      const byGraphicId = /* @__PURE__ */ new Map();
      const graphicIdCounts = /* @__PURE__ */ new Map();
      const layers = flattenLayers((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []).filter(
        (layer) => typeof layer.id === "string" && this.managedGraphicLayerIds.has(layer.id)
      );
      for (const layer of layers) {
        await ((_d = layer.load) == null ? void 0 : _d.call(layer));
        if (!isQueryableLayer(layer)) {
          continue;
        }
        const query = layer.createQuery();
        query.outFields = ["*"];
        query.returnGeometry = true;
        const result = await layer.queryFeatures(query);
        for (const graphic of (_e = result.features) != null ? _e : []) {
          const graphicJson = serializeValue(graphic);
          const graphicId = isRecord4(graphicJson) ? readOwnedGraphicId(graphicJson) : null;
          if (!graphicId) {
            continue;
          }
          graphicIdCounts.set(graphicId, ((_f = graphicIdCounts.get(graphicId)) != null ? _f : 0) + 1);
          if (graphicIds.includes(graphicId) && !byGraphicId.has(graphicId)) {
            byGraphicId.set(graphicId, graphic);
          }
        }
      }
      const ambiguousGraphicId = graphicIds.find(
        (graphicId) => {
          var _a2;
          return ((_a2 = graphicIdCounts.get(graphicId)) != null ? _a2 : 0) > 1;
        }
      );
      if (ambiguousGraphicId) {
        throw new Error(
          `Graphic ID "${ambiguousGraphicId}" matches ${graphicIdCounts.get(ambiguousGraphicId)} managed Graphics, so it cannot be resolved uniquely.`
        );
      }
      const missingGraphicIds = graphicIds.filter((graphicId) => !byGraphicId.has(graphicId));
      if (missingGraphicIds.length > 0) {
        const availableGraphicIds = [...graphicIdCounts].flatMap(
          ([graphicId, count]) => count === 1 ? [graphicId] : []
        );
        const missingDescription = missingGraphicIds.length === 1 ? `Graphic ${quoteValue(missingGraphicIds[0])}` : `Graphics ${quoteValues(missingGraphicIds)}`;
        throw new Error(
          `${missingDescription} ${missingGraphicIds.length === 1 ? "was" : "were"} not found. ${describeAvailableIds("graphic", availableGraphicIds)}`
        );
      }
      return graphicIds.map((graphicId) => byGraphicId.get(graphicId));
    }
    createBehaviorContext(options) {
      const { approvedModulePaths, cleanupCallbacks, scope, declaredMounts } = options;
      const assertActive = () => this.assertProgramScopeActive(scope);
      const readLayers = () => this.layerMap();
      const readTheme = () => this.config.app.theme.mode;
      const objects = {
        getFeatures: async (layerId, featureIds) => {
          assertActive();
          const features = await this.getFeatureObjects(layerId, featureIds);
          assertActive();
          return features;
        },
        getGraphics: async (graphicIds) => {
          assertActive();
          const graphics = await this.getPersistentGraphics(graphicIds);
          assertActive();
          return graphics;
        }
      };
      return {
        metadata: {
          version: this.config.version,
          kind: this.config.kind,
          appId: this.config.nova.basename,
          title: this.config.item.title,
          ...this.config.item.subtitle ? { subtitle: this.config.item.subtitle } : {},
          template: this.config.app.template,
          preset: this.config.app.preset
        },
        behaviorId: options.behaviorId,
        config: immutableJsonSnapshot(options.config),
        document: immutableJsonSnapshot(this.config),
        portalUrl: this.resources.portalUrl,
        map: this.resources.map,
        view: this.resources.view,
        get layers() {
          return readLayers();
        },
        inspect: () => this.inspect(),
        import: async (moduleId) => {
          assertActive();
          if (!approvedModulePaths.has(moduleId)) {
            throw new Error(
              `ArcGIS module "${moduleId}" was not statically approved for this behavior.`
            );
          }
          return await this.importModule(moduleId);
        },
        theme: Object.freeze({
          get current() {
            return readTheme();
          }
        }),
        actions: this.createProgramActionsApi(scope, options.allowActiveActionInvocation),
        objects: Object.freeze(objects),
        getMount: (blockId) => {
          assertActive();
          if (declaredMounts && !declaredMounts.has(blockId)) {
            throw new Error(
              `Behavior "${options.behaviorId}" did not declare mount "${blockId}". List every customMount block it fills in install_app_behavior mounts.`
            );
          }
          const mount = this.findMountElement(blockId);
          if (!mount) {
            throw new Error(
              `No customMount block "${blockId}" is in the app layout. Add it with update_app_region first.`
            );
          }
          return mount;
        },
        createResultLayer: async (layerOptions) => {
          assertActive();
          return await this.createResultLayer(layerOptions, assertActive);
        },
        setStatus: (message) => {
          assertActive();
          this.status = message;
        },
        reportError: (error) => {
          assertActive();
          const message = error instanceof Error ? error.message : String(error);
          const behavior = this.behaviors.get(options.behaviorId);
          if (behavior) {
            behavior.error = message;
          }
          this.status = `Behavior "${options.behaviorId}" reported: ${message}`;
          this.recordDebugEvent("runtime", "behavior-error", "failed", {
            behaviorId: options.behaviorId,
            error: sanitizeErrorMessage(error)
          });
        },
        onCleanup: (callback) => {
          assertActive();
          cleanupCallbacks.push(callback);
        },
        assert: (condition, message) => {
          if (!condition) {
            throw new Error(message);
          }
        }
      };
    }
    /**
     * A client-side FeatureLayer a module owns, written only through `applyEdits`.
     *
     * `FeatureLayer.source` is read once, when the layer initializes; assigning or mutating it
     * afterwards changes nothing on the map, and nothing reports that. A 2026-09-19 behavior did
     * exactly that and verified as "0 service areas" with no error anywhere. The handle assigns the
     * object ids itself, from a counter that never repeats, so a batch cannot collide with the one
     * it replaces, and it fails loudly on any edit the layer rejects.
     */
    async createResultLayer(options, assertActive) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const id = typeof options.id === "string" ? options.id.trim() : "";
      if (!id) {
        throw new Error("createResultLayer requires a layer id.");
      }
      if (!RESULT_LAYER_GEOMETRY_TYPES.has(options.geometryType)) {
        throw new Error(
          `createResultLayer requires geometryType "point", "multipoint", "polyline" or "polygon"; received ${JSON.stringify(options.geometryType)}.`
        );
      }
      const objectIdField = ((_a = options.objectIdField) == null ? void 0 : _a.trim()) || "OBJECTID";
      const existing = (_c = (_b = this.resources.map).findLayerById) == null ? void 0 : _c.call(_b, id);
      if (existing && !this.activeBehaviorOwnedLayerIds().has(id) && !this.resultLayerObjectIdCounters.has(id)) {
        throw new Error(
          `Layer "${id}" is already in the map document. A result layer needs an id of its own.`
        );
      }
      const [FeatureLayer, Graphic] = await Promise.all([
        this.importModule("esri/layers/FeatureLayer"),
        this.importModule("esri/Graphic")
      ]);
      let layer = existing;
      if (!layer) {
        const spatialReference = this.resources.view.spatialReference;
        layer = new FeatureLayer({
          id,
          title: (_d = options.title) != null ? _d : id,
          source: [],
          objectIdField,
          fields: [
            { name: objectIdField, type: "oid" },
            ...((_e = options.fields) != null ? _e : []).filter((field) => field.name !== objectIdField)
          ],
          geometryType: options.geometryType,
          ...spatialReference !== void 0 ? { spatialReference } : {},
          ...options.renderer !== void 0 ? { renderer: options.renderer } : {},
          ...options.popupTemplate !== void 0 ? { popupTemplate: options.popupTemplate } : {}
        });
        (_g = (_f = this.resources.map).add) == null ? void 0 : _g.call(_f, layer);
      }
      const resultLayer = layer;
      const counter = (_h = this.resultLayerObjectIdCounters.get(id)) != null ? _h : { next: 1 };
      this.resultLayerObjectIdCounters.set(id, counter);
      const replace = async (features) => {
        var _a2, _b2, _c2, _d2, _e2, _f2, _g2;
        assertActive();
        await ((_a2 = resultLayer.load) == null ? void 0 : _a2.call(resultLayer));
        const objectIds = (_c2 = await ((_b2 = resultLayer.queryObjectIds) == null ? void 0 : _b2.call(resultLayer))) != null ? _c2 : [];
        const addFeatures = features.map((feature) => {
          var _a3;
          const graphic = isGraphicLike(feature) ? feature : new Graphic(feature);
          graphic.attributes = { ...(_a3 = graphic.attributes) != null ? _a3 : {}, [objectIdField]: counter.next };
          counter.next += 1;
          return graphic;
        });
        const result = await resultLayer.applyEdits({
          deleteFeatures: objectIds.map((objectId) => ({ objectId })),
          addFeatures
        });
        const rejected = [
          ...(_d2 = result == null ? void 0 : result.deleteFeatureResults) != null ? _d2 : [],
          ...(_e2 = result == null ? void 0 : result.addFeatureResults) != null ? _e2 : []
        ].find((entry) => entry == null ? void 0 : entry.error);
        if (rejected == null ? void 0 : rejected.error) {
          throw new Error(
            `Result layer "${id}" rejected an edit: ${(_g2 = (_f2 = rejected.error.message) != null ? _f2 : rejected.error.name) != null ? _g2 : "unknown error"}.`
          );
        }
        return { added: addFeatures.length, removed: objectIds.length };
      };
      return {
        layer: resultLayer,
        replaceFeatures: replace,
        clear: async () => ({ removed: (await replace([])).removed })
      };
    }
    createProgramActionsApi(scope, allowActiveActionInvocation) {
      return Object.freeze({
        register: (actionId, handler) => this.registerProgramAction(scope, actionId, handler),
        invoke: async (actionId, input) => {
          this.assertProgramScopeActive(scope);
          const resolved = this.resolveProgramAction(
            scope.actions,
            actionId,
            allowActiveActionInvocation
          );
          return await this.invokeProgramAction(
            resolved.actionId,
            resolved.handler,
            input
          );
        },
        has: (actionId) => {
          this.assertProgramScopeActive(scope);
          return this.hasProgramAction(scope.actions, actionId, allowActiveActionInvocation);
        },
        list: () => {
          this.assertProgramScopeActive(scope);
          return this.listProgramActions(scope.actions, allowActiveActionInvocation);
        }
      });
    }
    registerProgramAction(scope, actionId, handler) {
      this.assertProgramScopeActive(scope);
      const id = actionId.trim();
      if (!id) {
        throw new Error("App actions require a non-empty actionId.");
      }
      if (typeof handler !== "function") {
        throw new Error(`App action "${id}" requires a function handler.`);
      }
      if (scope.actions.has(id)) {
        throw new Error(`App action "${id}" is already registered in this module context.`);
      }
      const owner = [...this.behaviors.values()].find(
        (behavior) => behavior.scope !== scope && behavior.status === "active" && behavior.scope.active && behavior.scope.actions.has(id)
      );
      if (owner) {
        throw new Error(`App action "${id}" is already registered by behavior "${owner.record.id}".`);
      }
      scope.actions.set(id, handler);
      return Object.freeze({
        remove: () => {
          this.assertProgramScopeActive(scope);
          if (scope.actions.get(id) === handler) {
            scope.actions.delete(id);
          }
        }
      });
    }
    /** The handler an active behavior registered for `actionId`, if one did. */
    findActiveBehaviorAction(actionId) {
      for (const behavior of this.behaviors.values()) {
        if (behavior.status === "active" && behavior.scope.active) {
          const handler = behavior.scope.actions.get(actionId);
          if (handler) {
            return handler;
          }
        }
      }
      return void 0;
    }
    hasProgramAction(localActions, actionId, allowActiveActionInvocation) {
      const id = actionId.trim();
      return !!id && (localActions.has(id) || allowActiveActionInvocation && this.findActiveBehaviorAction(id) !== void 0);
    }
    listProgramActions(localActions, allowActiveActionInvocation) {
      return [
        .../* @__PURE__ */ new Set([
          ...localActions.keys(),
          ...allowActiveActionInvocation ? this.activeActionIds() : []
        ])
      ].sort();
    }
    resolveProgramAction(localActions, actionId, allowActiveActionInvocation) {
      const id = actionId.trim();
      if (!id) {
        throw new Error("App actions require a non-empty actionId.");
      }
      const local = localActions.get(id);
      if (local) {
        return { actionId: id, handler: local };
      }
      if (allowActiveActionInvocation) {
        const active = this.findActiveBehaviorAction(id);
        if (active) {
          return { actionId: id, handler: active };
        }
      }
      const available = this.listProgramActions(localActions, allowActiveActionInvocation);
      throw new Error(
        `No app action "${id}" is registered. Registered actions: ${available.join(", ") || "none"}.`
      );
    }
    async invokeActiveProgramAction(actionId, input, sourceInteractionId) {
      const handler = this.findActiveBehaviorAction(actionId);
      if (!handler) {
        throw new Error(
          `No active behavior registered app action "${actionId}". Registered actions: ${this.activeActionIds().join(", ") || "none"}.`
        );
      }
      return await this.invokeProgramAction(actionId, handler, input, sourceInteractionId);
    }
    async invokeProgramAction(actionId, handler, input, sourceInteractionId) {
      const startedAt = Date.now();
      const layerIdsBefore = this.snapshotTopLevelLayerIds();
      const owner = [...this.behaviors.values()].find(
        (behavior) => behavior.status === "active" && behavior.scope.active && behavior.scope.actions.get(actionId) === handler
      );
      this.recordDebugEvent("runtime", "app-action", "started", {
        actionId,
        ...sourceInteractionId ? { interactionId: sourceInteractionId } : {}
      });
      try {
        const result = await handler(input);
        this.recordDebugEvent("runtime", "app-action", "succeeded", {
          actionId,
          durationMs: Date.now() - startedAt,
          ...sourceInteractionId ? { interactionId: sourceInteractionId } : {}
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.status = `App action "${actionId}" failed: ${message}`;
        this.recordDebugEvent("runtime", "app-action", "failed", {
          actionId,
          durationMs: Date.now() - startedAt,
          ...sourceInteractionId ? { interactionId: sourceInteractionId } : {},
          error: sanitizeErrorMessage(error)
        });
        throw error;
      } finally {
        const addedLayerIds = [...this.snapshotTopLevelLayerIds()].filter(
          (layerId) => !layerIdsBefore.has(layerId)
        );
        if (owner && this.behaviors.get(owner.record.id) === owner && owner.status === "active") {
          addedLayerIds.forEach((layerId) => owner.ownedLayerIds.add(layerId));
        } else if (owner) {
          this.removeLayersById(addedLayerIds);
        }
      }
    }
    async runCleanupCallbacks(callbacks, returnedCleanup) {
      let failure2;
      while (callbacks.length > 0) {
        const callback = callbacks.pop();
        if (!callback) {
          continue;
        }
        try {
          await callback();
        } catch (error) {
          failure2 != null ? failure2 : failure2 = error;
        }
      }
      if (returnedCleanup) {
        try {
          await returnedCleanup();
        } catch (error) {
          failure2 != null ? failure2 : failure2 = error;
        }
      }
      if (failure2) {
        throw failure2;
      }
    }
    assertProgramScopeActive(scope) {
      if (!scope.active) {
        throw new Error("This app program context is no longer active.");
      }
    }
    async importWorkspaceModule(modulePath) {
      return await import(new URL(modulePath, window.location.href).toString());
    }
    inspectDom(payload) {
      const root = readDomRoot(payload.root);
      const maxDepth = readBoundedInt(payload.maxDepth, 4, 0, 8);
      const maxNodes = readBoundedInt(payload.maxNodes, 120, 1, 300);
      const maxTextLength = readBoundedInt(payload.maxTextLength, 80, 0, 200);
      const rootElement = this.resolveDomRoot(root);
      if (!rootElement) {
        throw new Error(`The app DOM root "${root}" is unavailable.`);
      }
      const counter = { count: 0, truncated: false };
      const snapshotId = createRuntimeSnapshotId();
      const tree = buildDomNodeSnapshot(rootElement, {
        root,
        snapshotId,
        maxDepth,
        maxNodes,
        maxTextLength,
        counter,
        path: "0"
      });
      return {
        generation: this.generation,
        snapshotId,
        root,
        nodeCount: counter.count,
        truncated: counter.truncated,
        maxDepth,
        maxNodes,
        maxTextLength,
        tree
      };
    }
    readDebugRuntime(payload) {
      const maxEvents = readBoundedInt(payload.maxEvents, 50, 1, 200);
      const includeState = payload.includeState !== false;
      const events = this.debugEvents.slice(-maxEvents).map((event) => structuredClone(event));
      return {
        generation: this.generation,
        truncated: this.debugEvents.length > events.length,
        eventCount: this.debugEvents.length,
        events,
        ...includeState ? { state: this.readDebugState() } : {}
      };
    }
    readDebugState() {
      var _a, _b, _c;
      return {
        appId: this.config.nova.basename,
        title: this.config.item.title,
        mapType: this.config.map.type,
        startup: this.startupState,
        generation: this.generation,
        ...this.status ? { status: this.status } : {},
        behaviors: this.behaviorStates(),
        actionIds: this.activeActionIds(),
        widgetIds: [...this.widgets.keys()],
        layerIds: ((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []).flatMap(
          (layer) => typeof layer.id === "string" && layer.id ? [layer.id] : []
        )
      };
    }
    resolveDomRoot(root) {
      switch (root) {
        case "page":
          return document.body;
        case "header":
          return document.getElementById("app-header");
        case "main":
          return document.querySelector("main.app-main");
        case "view":
          return document.getElementById("app-view");
        case "left":
          return document.getElementById("app-region-left");
        case "right":
          return document.getElementById("app-region-right");
        case "footer":
          return document.getElementById("app-region-footer");
      }
    }
    recordDebugEvent(phase, action, status, details) {
      this.debugSequence += 1;
      this.debugEvents.push({
        seq: this.debugSequence,
        phase,
        action,
        status,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        ...(details == null ? void 0 : details.durationMs) !== void 0 ? { durationMs: details.durationMs } : {},
        ...details ? { details: redactDebugDetails(details) } : {}
      });
      if (this.debugEvents.length > MAX_DEBUG_EVENTS) {
        this.debugEvents.splice(0, this.debugEvents.length - MAX_DEBUG_EVENTS);
      }
    }
    layerMap() {
      var _a, _b, _c;
      return Object.fromEntries(
        flattenLayers((_c = (_b = (_a = this.resources.map.layers) == null ? void 0 : _a.toArray) == null ? void 0 : _b.call(_a)) != null ? _c : []).flatMap(
          (layer) => layer.id ? [[layer.id, layer]] : []
        )
      );
    }
    /** Routes uncaught frame errors into the bounded app-code diagnostics. */
    captureFrameErrors() {
      window.addEventListener("error", (event) => {
        var _a;
        this.recordFrameError((_a = event.error) != null ? _a : event.message, event.filename);
      });
      window.addEventListener("unhandledrejection", (event) => {
        this.recordFrameError(event.reason, void 0);
      });
    }
    recordFrameError(error, filename) {
      var _a;
      const programPath = (_a = programPathFromFrame(filename)) != null ? _a : programPathFromFrame(error == null ? void 0 : error.stack);
      if (programPath) {
        const message = sanitizeErrorMessage(error);
        const behavior = [...this.behaviors.values()].find(
          (candidate) => programPath.endsWith(candidate.record.bundlePath.replace(/^\.\//u, ""))
        );
        if (behavior) {
          behavior.error = message;
        }
        this.status = behavior ? `Behavior "${behavior.record.id}" failed: ${message}` : `App code failed: ${message}`;
      }
      this.recordDebugEvent("runtime", "uncaught", "failed", {
        error: sanitizeErrorMessage(error),
        ...programPath ? { programPath } : {}
      });
    }
  };
  function readScriptTimeout(value) {
    return appRuntimeScriptTimeoutMs(value);
  }
  function readApprovedScriptModulePaths(value) {
    if (!Array.isArray(value) || !value.every(
      (moduleId) => typeof moduleId === "string" && isSupportedArcgisModuleId(moduleId) && !isSensitiveArcgisModuleId(moduleId)
    )) {
      throw new Error("App code execution requires its exact preflight-approved module paths.");
    }
    return new Set(value);
  }
  function readWorkspaceModulePath(value, command) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${command} requires a modulePath.`);
    }
    return value;
  }
  function readModuleEntry(value, modulePath) {
    const entry = isRecord4(value) ? value.default : void 0;
    if (typeof entry !== "function") {
      throw new Error(`Module "${modulePath}" must export one default function.`);
    }
    return entry;
  }
  function readBehaviorRecord(value) {
    if (!isRecord4(value) || typeof value.id !== "string" || !value.id || typeof value.bundlePath !== "string" || !value.bundlePath.startsWith("./runtime/behaviors/") || !Array.isArray(value.modulePaths) || !Array.isArray(value.mounts) || !Array.isArray(value.interactions) || !Array.isArray(value.ownedLayerIds) || !isRecord4(value.config)) {
      throw new Error("install-behavior requires a complete behavior record.");
    }
    return value;
  }
  function readRegionName(value) {
    if (value === "header" || value === "left" || value === "right" || value === "footer") {
      return value;
    }
    throw new Error("A valid region is required.");
  }
  function isAppRegion(value) {
    return typeof value === "object" && value !== null && Array.isArray(value.blocks) && value.blocks.length > 0;
  }
  function isAppWidget(value) {
    return typeof value === "object" && value !== null && typeof value.id === "string" && typeof value.type === "string";
  }
  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
      node.hidden = value.length === 0;
    }
  }
  function escapeSelector(value) {
    return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  }
  function cssIdentifier(value) {
    return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/[^A-Za-z0-9_-]/gu, (character) => `\\${character}`);
  }
  function readReturnedCleanup(value) {
    if (typeof value === "function") {
      return async () => {
        await value();
      };
    }
    return null;
  }
  function requireRecord(value, error) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(error);
    }
    return value;
  }
  function readObjectIdentity(value, name) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`app.objects requires a non-empty ${name}.`);
    }
    return value;
  }
  function readFeatureIdentities(value) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error("app.objects.getFeatures requires one or more feature ids.");
    }
    const featureIds = value.map((featureId, index) => {
      if (typeof featureId === "number" && Number.isFinite(featureId)) {
        return featureId;
      }
      if (typeof featureId === "string" && featureId.trim().length > 0) {
        return featureId;
      }
      throw new Error(`app.objects received an invalid feature id at index ${index}.`);
    });
    if (new Set(featureIds.map(String)).size !== featureIds.length) {
      throw new Error("app.objects.getFeatures requires unique feature ids.");
    }
    return featureIds;
  }
  function quoteValue(value) {
    return JSON.stringify(value);
  }
  function quoteValues(values) {
    return values.map(quoteValue).join(", ");
  }
  function describeAvailableIds(kind, values) {
    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length === 0) {
      return `No ${kind} IDs are available.`;
    }
    const visibleValues = uniqueValues.slice(0, MAX_OBJECT_ID_SUGGESTIONS);
    const truncation = uniqueValues.length > visibleValues.length ? ` Only the first ${MAX_OBJECT_ID_SUGGESTIONS} are shown.` : "";
    return `Available ${kind} IDs: ${quoteValues(visibleValues)}.${truncation}`;
  }
  function readExactFeatureObjectId(objectIdField, feature) {
    var _a, _b, _c, _d, _e;
    const objectId = (_e = (_c = (_a = feature.getObjectId) == null ? void 0 : _a.call(feature)) != null ? _c : objectIdField ? (_b = feature.attributes) == null ? void 0 : _b[objectIdField] : void 0) != null ? _e : (_d = feature.attributes) == null ? void 0 : _d.OBJECTID;
    return objectId === null || objectId === void 0 ? null : String(objectId);
  }
  function describeUnwrittenValues(messages, liveLayerIds) {
    return [
      ...new Set(
        messages.flatMap((entry) => {
          var _a, _b;
          const targetId = (_b = (_a = entry.details) == null ? void 0 : _a.target) == null ? void 0 : _b.id;
          return typeof targetId === "string" && liveLayerIds.has(targetId) || !entry.message ? [] : [`The saved document left out a value: ${entry.message}`];
        })
      )
    ];
  }
  function requireRecords(value, error) {
    if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
      throw new Error(error);
    }
    return value;
  }
  function readBoundedInt(value, fallback, min, max) {
    if (!Number.isInteger(value) || typeof value !== "number") {
      return fallback;
    }
    return Math.max(min, Math.min(max, value));
  }
  function programPathFromFrame(source) {
    var _a, _b;
    if (typeof source !== "string") {
      return null;
    }
    return (_b = (_a = /\/(?:runtime\/behaviors|\.nova-dev\/tasks)\/[^?\s)]+\.js/u.exec(source)) == null ? void 0 : _a[0]) != null ? _b : null;
  }
  function sanitizeErrorMessage(error) {
    return redactString(error instanceof Error ? error.message : String(error));
  }
  function createRuntimeSnapshotId() {
    if (typeof (crypto == null ? void 0 : crypto.randomUUID) === "function") {
      return crypto.randomUUID();
    }
    return `snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function redactDebugDetails(details) {
    return Object.fromEntries(
      Object.entries(details).map(([key, value]) => {
        if (typeof value === "string") {
          return [key, redactString(value)];
        }
        return [key, value];
      })
    );
  }
  function redactString(value) {
    return value.replace(/access[_-]?token/giu, "[redacted-token]").replace(/authorization/giu, "[redacted-auth]").replace(/client[_-]?secret/giu, "[redacted-secret]");
  }
  function readGraphicPersistenceResult(payload) {
    const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
    if (!requestId) {
      throw new Error("persist-graphic-result requires a requestId.");
    }
    if (payload.success === false) {
      const error = isRecord4(payload.error) ? payload.error : null;
      const code = typeof (error == null ? void 0 : error.code) === "string" ? error.code.trim() : "";
      const message = typeof (error == null ? void 0 : error.message) === "string" ? error.message.trim() : "";
      if (!code || !message) {
        throw new Error("persist-graphic-result requires an error code and message.");
      }
      return { requestId, success: false, error: { code, message } };
    }
    const graphic = isRecord4(payload.graphic) ? payload.graphic : null;
    if (payload.success !== true || !graphic || typeof graphic.graphicId !== "string" || typeof payload.appliedLive !== "boolean" || typeof payload.reloadRequired !== "boolean") {
      throw new Error("persist-graphic-result requires a successful Graphic result.");
    }
    return {
      requestId,
      success: true,
      graphic: structuredClone(graphic),
      appliedLive: payload.appliedLive,
      reloadRequired: payload.reloadRequired
    };
  }
  function normalizeAggregateGroupValue(value) {
    return typeof value === "string" || typeof value === "number" ? value : null;
  }
  var MODULE_IMPORT_TIMEOUT_MS = 15e3;
  async function withModuleImportTimeout(loading, moduleId) {
    let timeout;
    try {
      return await Promise.race([
        loading,
        new Promise((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(
              new Error(
                `app.import("${moduleId}") did not return within ${MODULE_IMPORT_TIMEOUT_MS / 1e3} seconds. The most likely cause is a module id this SDK version does not have, which the loader never answers. Check the id with inspect_maps_sdk before importing it again.`
              )
            ),
            MODULE_IMPORT_TIMEOUT_MS
          );
        })
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
  function withGeographicDefault(value) {
    const json = requireRecord(value, "A valid geometry JSON object is required.");
    if (isRecord4(json.spatialReference)) {
      return json;
    }
    const xs = [json.x, json.xmin, json.xmax].filter(
      (entry) => typeof entry === "number"
    );
    const ys = [json.y, json.ymin, json.ymax].filter(
      (entry) => typeof entry === "number"
    );
    if (xs.length === 0 || ys.length === 0 || xs.some((x) => Math.abs(x) > 180) || ys.some((y) => Math.abs(y) > 90)) {
      throw new Error(
        "These coordinates are not longitude and latitude, so they need their spatialReference."
      );
    }
    return { ...json, spatialReference: { wkid: 4326 } };
  }
  function droppedSymbolTypes(submitted, readBack) {
    const applied = new Set(collectSymbolTypes(readBack));
    return [...new Set(collectSymbolTypes(submitted))].filter((name) => !applied.has(name));
  }

  // src/frame/auth.ts
  function getRuntimeAuth() {
    const auth = window.__novaAuth;
    if (!auth || !auth.token || !auth.portalUrl) {
      return null;
    }
    if (auth.expiresAt && auth.expiresAt <= Date.now()) {
      return null;
    }
    return auth;
  }
  var enterpriseInterceptorOrigin = null;
  var enterpriseToken = null;
  function registerRuntimeAuth(IdentityManager, esriConfig) {
    const auth = getRuntimeAuth();
    delete window.__novaAuth;
    const manager = IdentityManager;
    const config = esriConfig;
    if (config) {
      delete config.apiKey;
    }
    if (!manager || typeof manager.registerToken !== "function" || !config || !auth) {
      return void 0;
    }
    const portalUrl = applyRuntimeAuth(manager, config, auth);
    if (portalUrl) {
      installRuntimeAuthUpdate(manager, config, portalUrl);
    }
    return portalUrl;
  }
  function applyRuntimeAuth(manager, config, auth) {
    try {
      const portalUrl = portalRootUrl(auth.portalUrl);
      config.portalUrl = portalUrl;
      manager.registerToken({
        server: `${portalUrl}/sharing/rest`,
        token: auth.token,
        expires: auth.expiresAt || void 0,
        userId: auth.username || void 0,
        ssl: true
      });
      if (isArcGisOnlinePortal(portalUrl)) {
        config.apiKey = auth.token;
      } else {
        enterpriseToken = auth.token;
        installEnterpriseInterceptor(config, portalUrl);
      }
      return portalUrl;
    } catch (error) {
      reportError("preview auth registration failed for " + auth.portalUrl, error);
      return void 0;
    }
  }
  function installRuntimeAuthUpdate(manager, config, registeredPortalUrl) {
    window.__novaApplyAuth = (next) => {
      if (!(next == null ? void 0 : next.token) || !next.portalUrl || portalRootUrl(next.portalUrl) !== registeredPortalUrl) {
        return false;
      }
      return applyRuntimeAuth(manager, config, {
        token: next.token,
        portalUrl: next.portalUrl,
        ...next.expiresAt ? { expiresAt: next.expiresAt } : {},
        ...next.username ? { username: next.username } : {}
      }) !== void 0;
    };
  }
  function portalRootUrl(value) {
    return value.trim().replace(/\/sharing\/rest\/?$/iu, "").replace(/\/+$/u, "");
  }
  function isArcGisOnlinePortal(value) {
    const host = new URL(value).hostname.toLowerCase();
    return host === "arcgis.com" || host.endsWith(".arcgis.com");
  }
  function installEnterpriseInterceptor(config, portalUrl) {
    var _a;
    const origin = new URL(portalUrl).origin;
    if (enterpriseInterceptorOrigin === origin) {
      return;
    }
    const interceptors = (_a = config.request) == null ? void 0 : _a.interceptors;
    if (!interceptors) {
      return;
    }
    const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    interceptors.push({
      urls: new RegExp(`^${escapedOrigin}/`, "u"),
      before(params) {
        var _a2, _b, _c, _d, _e;
        (_a2 = params.requestOptions) != null ? _a2 : params.requestOptions = {};
        (_c = (_b = params.requestOptions).query) != null ? _c : _b.query = {};
        if (enterpriseToken) {
          (_e = (_d = params.requestOptions.query).token) != null ? _e : _d.token = enterpriseToken;
        }
      }
    });
    enterpriseInterceptorOrigin = origin;
  }

  // src/frame/view.ts
  var MODULE_IDS = [
    "esri/WebMap",
    "esri/WebScene",
    "esri/Basemap",
    "esri/views/MapView",
    "esri/views/SceneView",
    "esri/layers/FeatureLayer",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/identity/IdentityManager",
    "esri/config"
  ];
  function collectionLength(value) {
    const collection = asRecord(value);
    const length = collection == null ? void 0 : collection.length;
    if (typeof length === "number") {
      return length;
    }
    return typeof (collection == null ? void 0 : collection.toArray) === "function" ? collection.toArray().length : 0;
  }
  function declaresBasemapLayers(document2, map) {
    const baseMap = asRecord(document2.baseMap);
    if (Array.isArray(baseMap == null ? void 0 : baseMap.baseMapLayers) && baseMap.baseMapLayers.length > 0) {
      return true;
    }
    const basemap = asRecord(map.basemap);
    return Boolean(basemap) && (collectionLength(basemap == null ? void 0 : basemap.baseLayers) > 0 || collectionLength(basemap == null ? void 0 : basemap.referenceLayers) > 0);
  }
  function observeViewResize(container, view) {
    if (typeof ResizeObserver === "undefined") {
      return () => void 0;
    }
    let scheduled = false;
    const observer = new ResizeObserver(() => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(() => {
        var _a;
        scheduled = false;
        (_a = view.resize) == null ? void 0 : _a.call(view);
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }
  function suppressViewFocusFrame(container) {
    container.style.setProperty("--arcgis-internal-view-outline", "none");
    container.style.setProperty("--esri-view-outline", "none");
  }
  function restoreBuiltInTerrain(map, mapDocument) {
    const ground = asRecord(mapDocument.ground);
    const groundId = typeof (ground == null ? void 0 : ground.groundId) === "string" ? ground.groundId.trim() : "";
    if (!groundId) {
      return void 0;
    }
    const customGroundLayers = readGroundLayers(map.ground);
    map.ground = groundId;
    const restoredGround = asRecord(map.ground);
    const restoredGroundLayers = asRecord(restoredGround == null ? void 0 : restoredGround.layers);
    const addGroundLayer = restoredGroundLayers == null ? void 0 : restoredGroundLayers.add;
    if (typeof addGroundLayer !== "function") {
      return groundId;
    }
    customGroundLayers.forEach((layer) => addGroundLayer.call(restoredGroundLayers, layer));
    return groundId;
  }
  function readGroundLayers(ground) {
    var _a;
    const layers = asRecord((_a = asRecord(ground)) == null ? void 0 : _a.layers);
    if (typeof (layers == null ? void 0 : layers.toArray) !== "function") {
      return [];
    }
    const values = layers.toArray();
    return Array.isArray(values) ? values : [];
  }
  function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  function readInitialView(mapDocument, scene) {
    var _a;
    const viewpoint = asRecord((_a = asRecord(mapDocument.initialState)) == null ? void 0 : _a.viewpoint);
    const target = asRecord(viewpoint == null ? void 0 : viewpoint.targetGeometry);
    const scale = typeof (viewpoint == null ? void 0 : viewpoint.scale) === "number" && viewpoint.scale > 0 ? viewpoint.scale : null;
    if (scene && asRecord(viewpoint == null ? void 0 : viewpoint.camera)) {
      return {};
    }
    if (!target) {
      return {};
    }
    if (typeof target.xmin === "number" && typeof target.ymin === "number") {
      return { extent: target };
    }
    if (typeof target.x !== "number" || typeof target.y !== "number") {
      return {};
    }
    return {
      center: target,
      ...scale ? { scale } : {}
    };
  }
  function initView(config, mapDocument) {
    const container = document.getElementById("app-view");
    if (!container) {
      return Promise.reject(new Error("The app map container is missing."));
    }
    return new Promise((resolve, reject) => {
      loadArcgisModules(
        MODULE_IDS,
        async (modules, moduleLoader) => {
          var _a, _b, _c;
          try {
            const portalUrl = registerRuntimeAuth(
              modules["esri/identity/IdentityManager"],
              modules["esri/config"]
            );
            const scene = isScene(config);
            const Document = modules[scene ? "esri/WebScene" : "esri/WebMap"];
            const View = modules[scene ? "esri/views/SceneView" : "esri/views/MapView"];
            if (!(Document == null ? void 0 : Document.fromJSON) || !View) {
              throw new Error("The ArcGIS Map or View module is unavailable.");
            }
            const { document: readableDocument, collections } = splitRuntimeFeatureCollections(
              mapDocument,
              scene
            );
            const map = Document.fromJSON(readableDocument);
            if (collections.length > 0) {
              restoreFeatureCollections(
                map,
                collections,
                modules["esri/layers/FeatureLayer"],
                modules["esri/layers/GraphicsLayer"],
                modules["esri/Graphic"]
              );
            }
            if (!declaresBasemapLayers(mapDocument, map)) {
              const Basemap = modules["esri/Basemap"];
              const fallback = (_a = Basemap == null ? void 0 : Basemap.fromId(
                scene ? DEFAULT_BLANK_SCENE_BASEMAP_ID : DEFAULT_BLANK_MAP_BASEMAP_ID
              )) != null ? _a : null;
              if (fallback) {
                map.basemap = fallback;
                void Promise.resolve((_b = fallback.load) == null ? void 0 : _b.call(fallback)).catch((error) => {
                  reportError("the fallback basemap could not be loaded", error);
                });
              }
            }
            const builtInGroundId = scene ? restoreBuiltInTerrain(map, mapDocument) : void 0;
            const appPresentation = config.nova.presentationMode === "app";
            suppressViewFocusFrame(container);
            const view = new View({
              container,
              map,
              popup: appPresentation ? { defaultPopupTemplateEnabled: true } : null,
              popupEnabled: appPresentation,
              ...readInitialView(mapDocument, scene)
            });
            if (scene) {
              recoverStalledSceneGoTo(view);
            }
            (_c = view.when) == null ? void 0 : _c.call(
              view,
              () => {
                const stopObservingResize = observeViewResize(container, view);
                window.addEventListener("pagehide", stopObservingResize, { once: true });
                resolve({
                  map,
                  view,
                  modules,
                  moduleLoader,
                  ...builtInGroundId ? { builtInGroundId } : {},
                  ...portalUrl ? { portalUrl } : {}
                });
              },
              (error) => reject(error)
            );
          } catch (error) {
            reportError("app view could not be initialized", error);
            reject(error);
          }
        },
        reject
      );
    });
  }
  function restoreFeatureCollections(map, collections, FeatureLayer, GraphicsLayer, Graphic) {
    var _a;
    const document2 = map;
    (_a = document2.when) == null ? void 0 : _a.call(document2, () => {
      var _a2, _b, _c, _d;
      for (const { index, json, parentId, sourceLayerType } of collections) {
        try {
          const layer = sourceLayerType === "graphics" ? readEmbeddedGraphicsCollectionLayer(GraphicsLayer, Graphic, json) : readEmbeddedFeatureCollectionLayer(FeatureLayer, json);
          const target = parentId ? (_b = (_a2 = document2.findLayerById) == null ? void 0 : _a2.call(document2, parentId)) == null ? void 0 : _b.layers : document2;
          (_c = target == null ? void 0 : target.add) == null ? void 0 : _c.call(target, layer, index);
        } catch (error) {
          reportError(`the layer "${String((_d = json.title) != null ? _d : json.id)}" could not be restored`, error);
        }
      }
    });
  }
  function recoverStalledSceneGoTo(view) {
    const goTo = view.goTo;
    if (typeof goTo !== "function") {
      return;
    }
    view.goTo = async (target, options) => {
      try {
        return await goTo.call(view, target, options);
      } catch (error) {
        if ((error == null ? void 0 : error.name) !== "GotoAnimation:missing-animation") {
          throw error;
        }
        return await goTo.call(view, target, { ...options, animate: false });
      }
    };
  }

  // src/frame/main.ts
  function fail(error) {
    const message = error instanceof Error ? error.message : String(error);
    const node = document.getElementById("app-error");
    if (node) {
      node.hidden = false;
      node.textContent = `This app could not load: ${message}`;
    }
  }
  async function boot() {
    var _a;
    const response = await fetch("./app.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`app.json returned HTTP ${response.status}.`);
    }
    const config = await response.json();
    if (!isAppArtifact(config)) {
      throw new Error("app.json is missing the Nova app document fields.");
    }
    document.body.classList.toggle("app-map-presentation", config.nova.presentationMode === "map");
    const mapResponse = await fetch(config.map.path, { cache: "no-store" });
    if (!mapResponse.ok) {
      throw new Error(`${config.map.path} returned HTTP ${mapResponse.status}.`);
    }
    const mapDocument = await mapResponse.json();
    applyAppTheme(config.app.theme.mode, config.app.theme.accent);
    document.title = config.item.title;
    document.getElementById("app-title").textContent = config.item.title;
    const subtitle = document.getElementById("app-subtitle");
    subtitle.textContent = (_a = config.item.subtitle) != null ? _a : "";
    subtitle.hidden = !config.item.subtitle;
    const controller = new AppRuntimeController(config, await initView(config, mapDocument));
    const announceRuntimeReady = installAppRuntimeBridge(controller);
    await controller.start();
    announceRuntimeReady();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot().catch(fail), { once: true });
  } else {
    void boot().catch(fail);
  }
})();
