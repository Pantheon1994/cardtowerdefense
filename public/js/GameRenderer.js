class GameRenderer {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Viewport system - keep canvas size fixed
    this.viewportWidth = 1280;
    this.viewportHeight = 720;
    this.canvas.width = this.viewportWidth;
    this.canvas.height = this.viewportHeight;
    
    // Camera system for navigation
    this.camera = {
      x: 0,  // Camera position in world coordinates
      y: 0,
      speed: 5, // Camera movement speed
      smoothing: 0.1 // Camera smoothing factor
    };
    
    // Map and path system - Updated for 1280x720 viewport
    this.mapWidth = 1280;  // World map width (matches new viewport)
    this.mapHeight = 720; // World map height (matches new viewport)
    this.paths = []; // Multiple paths support
    this.path = [ // Default path adapted for 1280x720 (matches server baseEndPoint)
      { x: 0, y: 360 },      // Start at middle left
      { x: 320, y: 360 },    // Move right
      { x: 320, y: 240 },    // Move up
      { x: 640, y: 240 },    // Move right
      { x: 640, y: 480 },    // Move down
      { x: 960, y: 480 },    // Move right
      { x: 960, y: 360 },    // Move up to center
      { x: 1200, y: 360 }    // End at base (matches server baseEndPoint)
    ];
    
    // Initialize with default path
    this.paths.push({
      id: 'path_0',
      points: this.path,
      color: '#FFD700'
    });
    
    // Camera controls (arrow keys only)
    this.keys = {
      ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
    };
    
    // Grid system
    this.gridCellSize = 40; // Même valeur que GRID_CONFIG.CELL_SIZE
    this.showGrid = false;
    this.previewPosition = null; // Position de la hitbox de prévisualisation
    this.gameState = null; // Pour accéder aux tours existantes
    
    // Generate tower placement zones automatically along the path
    this.towerZones = this.generateTowerZones();
    
    // Setup camera controls
    this.setupCameraControls();
  }

  setupCameraControls() {
    // Keyboard event listeners for camera movement (arrow keys only)
    document.addEventListener('keydown', (e) => {
      // Only handle arrow keys and only if chat is not active
      if (e.key in this.keys && !this.isChatActive()) {
        this.keys[e.key] = true;
        e.preventDefault();
      }
    });

    document.addEventListener('keyup', (e) => {
      // Only handle arrow keys
      if (e.key in this.keys) {
        this.keys[e.key] = false;
        e.preventDefault();
      }
    });

    // Mouse drag for camera movement
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) { // Middle mouse button
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        this.camera.x -= deltaX;
        this.camera.y -= deltaY;
        this.constrainCamera();
        
        lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        isDragging = false;
        this.canvas.style.cursor = 'default';
      }
    });

    // Scroll wheel for zoom (optional future feature)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Future: implement zoom functionality
    });
  }

  updateCamera() {
    // Handle keyboard movement (arrow keys only)
    const moveSpeed = this.camera.speed;
    
    if (this.keys.ArrowUp) this.camera.y -= moveSpeed;
    if (this.keys.ArrowDown) this.camera.y += moveSpeed;
    if (this.keys.ArrowLeft) this.camera.x -= moveSpeed;
    if (this.keys.ArrowRight) this.camera.x += moveSpeed;
    
    this.constrainCamera();
  }

  // Method to move camera programmatically (for external controls)
  moveCamera(deltaX, deltaY) {
    this.camera.x += deltaX;
    this.camera.y += deltaY;
    this.constrainCamera();
  }

  constrainCamera() {
    // Keep camera within map bounds
    const maxCameraX = Math.max(0, this.mapWidth - this.viewportWidth);
    const maxCameraY = Math.max(0, this.mapHeight - this.viewportHeight);
    
    this.camera.x = Math.max(0, Math.min(this.camera.x, maxCameraX));
    this.camera.y = Math.max(0, Math.min(this.camera.y, maxCameraY));
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.camera.x,
      y: worldY - this.camera.y
    };
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.camera.x,
      y: screenY + this.camera.y
    };
  }

  // Check if a world coordinate is visible in the current viewport
  isVisible(worldX, worldY, margin = 50) {
    const screen = this.worldToScreen(worldX, worldY);
    return screen.x >= -margin && 
           screen.x <= this.viewportWidth + margin &&
           screen.y >= -margin && 
           screen.y <= this.viewportHeight + margin;
  }

  updateMapDimensions(newDimensions) {
    this.mapWidth = newDimensions.width;
    this.mapHeight = newDimensions.height;
    
    // No need to change canvas size - it stays fixed
    // Just update camera constraints
    this.constrainCamera();
    
    console.log(`🗺️ Map dimensions updated to ${this.mapWidth}x${this.mapHeight} (viewport: ${this.viewportWidth}x${this.viewportHeight})`);
  }

  addNewPath(newPath) {
    const pathColor = this.getPathColor(this.paths.length);
    
    // Check if this path already exists (merged path case)
    const existingPathIndex = this.paths.findIndex(p => p.id === newPath.id);
    if (existingPathIndex !== -1) {
      // Update the existing path with new points (branched path)
      this.paths[existingPathIndex] = {
        id: newPath.id,
        points: newPath.points,
        color: pathColor,
        createdAtWave: newPath.createdAtWave,
        branchedFrom: newPath.branchedFrom,
        branchPoint: newPath.branchPoint,
        branches: newPath.branches || []
      };
    } else {
      // Add new path
      this.paths.push({
        id: newPath.id,
        points: newPath.points,
        color: pathColor,
        createdAtWave: newPath.createdAtWave,
        branchedFrom: newPath.branchedFrom,
        branchPoint: newPath.branchPoint,
        branches: newPath.branches || []
      });
    }
    
    // Update tower zones to include new/updated path
    this.towerZones = this.generateTowerZones();
  }

  updateAllPaths(allPaths) {
    
    // Clear existing paths
    this.paths = [];
    
    // Add all paths with appropriate colors
    allPaths.forEach((pathData, index) => {
      const pathColor = this.getPathColor(index);
      
      this.paths.push({
        id: pathData.id,
        points: pathData.points,
        color: pathColor,
        createdAtWave: pathData.createdAtWave,
        branchedFrom: pathData.branchedFrom,
        branchPoint: pathData.branchPoint,
        branches: pathData.branches || []
      });
    });
    
    // Update tower zones to include all paths
    this.towerZones = this.generateTowerZones();
  }

  getPathColor(pathIndex) {
    // Uniform color for all paths
    return '#8B4513'; // Brown/dirt color for all paths
  }

  generateTowerZones() {
    const zones = [];
    const pathBuffer = 50; // Distance from path where towers can be placed
    const zoneSize = 40; // Size of each tower zone
    const zoneSpacing = 60; // Spacing between zones
    
    // Generate zones along both sides of all paths
    this.paths.forEach(pathData => {
      const path = pathData.points;
      
      for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];
        
        // Calculate direction vector
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) continue;
        
        // Normalize direction
        const unitX = dx / length;
        const unitY = dy / length;
        
        // Perpendicular vectors for left and right sides
        const perpX = -unitY;
        const perpY = unitX;
        
        // Place zones along this segment
        const numZones = Math.floor(length / zoneSpacing);
        for (let j = 0; j <= numZones; j++) {
          const t = numZones > 0 ? j / numZones : 0;
          const pointX = current.x + t * dx;
          const pointY = current.y + t * dy;
          
          // Left side zones
          zones.push({
            x: pointX + perpX * pathBuffer - zoneSize / 2,
            y: pointY + perpY * pathBuffer - zoneSize / 2,
            width: zoneSize,
            height: zoneSize
          });
          
          // Right side zones
          zones.push({
            x: pointX - perpX * pathBuffer - zoneSize / 2,
            y: pointY - perpY * pathBuffer - zoneSize / 2,
            width: zoneSize,
            height: zoneSize
          });
        }
      }
    });
    
    return zones;
  }

  isInBounds(x, y, size) {
    const margin = size/2 + 10;
    return x >= margin && 
           x <= this.mapWidth - margin && 
           y >= margin && 
           y <= this.mapHeight - margin;
  }

  render(gameState) {
    this.gameState = gameState; // Stocker pour la validation de grille
    
    // Update camera position
    this.updateCamera();
    
    this.clearCanvas();
    
    // Save context for camera transform
    this.ctx.save();
    
    // Apply camera transform
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // Draw world elements (affected by camera)
    this.drawBackground();
    this.drawPath();
    
    // Dessiner la grille si nécessaire
    if (this.showGrid) {
      this.drawGrid();
    }
    
    // Dessiner la hitbox de prévisualisation si active
    if (this.previewPosition) {
      this.drawPreviewHitbox();
    }
    
    if (gameState) {
      this.drawTowers(gameState.towers || []);
      this.drawEnemies(gameState.enemies || []);
      this.drawProjectiles(gameState.projectiles || []);
      this.drawBase();
    }
    
    // Restore context
    this.ctx.restore();
    
    // Draw UI elements (not affected by camera)
    if (gameState) {
      this.drawWaveInfo(gameState);
    }
    
    // Draw camera info for debug
    this.drawCameraInfo();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  drawBackground() {
    // Calculate visible area in world coordinates
    const worldTopLeft = this.screenToWorld(0, 0);
    const worldBottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    
    // Draw grass background for the visible area
    this.ctx.fillStyle = '#4a7c59';
    this.ctx.fillRect(
      worldTopLeft.x, worldTopLeft.y,
      worldBottomRight.x - worldTopLeft.x,
      worldBottomRight.y - worldTopLeft.y
    );
    
    // Add some texture with dots (optimized for visible area)
    this.ctx.fillStyle = '#5d8a6b';
    const startX = Math.floor(worldTopLeft.x / 20) * 20;
    const startY = Math.floor(worldTopLeft.y / 20) * 20;
    const endX = Math.ceil(worldBottomRight.x / 20) * 20;
    const endY = Math.ceil(worldBottomRight.y / 20) * 20;
    
    for (let x = startX; x < endX; x += 20) {
      for (let y = startY; y < endY; y += 20) {
        if (Math.random() > 0.7) {
          this.ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  }

  drawPath() {
    const currentTime = Date.now();
    
    // Draw all paths with uniform color and directional animation
    this.paths.forEach((pathData, index) => {
      const path = pathData.points;
      const color = '#8B4513'; // Uniform brown/dirt color for all paths
      
      // Draw path border first
      this.ctx.strokeStyle = this.darkenColor(color, 0.3);
      this.ctx.lineWidth = 45;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        this.ctx.lineTo(path[i].x, path[i].y);
      }
      this.ctx.stroke();
      
      // Draw main path
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 40;
      
      this.ctx.beginPath();
      this.ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        this.ctx.lineTo(path[i].x, path[i].y);
      }
      this.ctx.stroke();
      
      // Draw directional animation (moving dots/arrows)
      this.drawPathAnimation(path, currentTime, index);
      
      // Draw path label for new paths
      if (index > 0) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${pathData.id}`, path[0].x, path[0].y - 20);
      }
      
      // Draw branch indicators if this path is branched
      if (pathData.branchedFrom) {
        this.drawBranchConnectionIndicator(pathData);
      }
      
      // Draw branch points if this path has branches
      if (pathData.branches && pathData.branches.length > 0) {
        this.drawBranchStartPoints(pathData);
      }
    });
  }

  drawBranchIndicators(pathData) {
    if (!pathData.branchPoint) return;
    
    const currentTime = Date.now();
    const pulse = Math.sin(currentTime / 300) * 0.3 + 0.7;
    
    // Draw pulsing circle at branch point
    this.ctx.globalAlpha = pulse;
    this.ctx.fillStyle = '#32CD32'; // Green color for branch indicators
    this.ctx.beginPath();
    this.ctx.arc(pathData.branchPoint.x, pathData.branchPoint.y, 10, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw branch symbol
    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🌳', pathData.branchPoint.x, pathData.branchPoint.y + 5);
    
    // Draw connection line to parent path
    this.ctx.strokeStyle = '#32CD32';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(pathData.branchPoint.x, pathData.branchPoint.y);
    this.ctx.lineTo(pathData.points[0].x, pathData.points[0].y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawBranchPoints(pathData) {
    if (!pathData.branches) return;
    
    const currentTime = Date.now();
    
    pathData.branches.forEach((branch, index) => {
      const pulse = Math.sin(currentTime / 400 + index) * 0.2 + 0.8;
      
      // Draw pulsing circle at branch point
      this.ctx.globalAlpha = pulse;
      this.ctx.fillStyle = '#FFD700'; // Gold color for branch points
      this.ctx.beginPath();
      this.ctx.arc(branch.branchPoint.x, branch.branchPoint.y, 8, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw branch symbol
      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#8B4513';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🔗', branch.branchPoint.x, branch.branchPoint.y + 4);
    });
    
    this.ctx.globalAlpha = 1.0;
  }

  drawBranchConnectionIndicator(pathData) {
    if (!pathData.branchPoint) return;
    
    const currentTime = Date.now();
    const pulse = Math.sin(currentTime / 300) * 0.3 + 0.7;
    
    // Draw pulsing circle at branch connection point
    this.ctx.globalAlpha = pulse;
    this.ctx.fillStyle = '#32CD32'; // Green color for branch connection
    this.ctx.beginPath();
    this.ctx.arc(pathData.branchPoint.x, pathData.branchPoint.y, 8, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw branch symbol
    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🌳', pathData.branchPoint.x, pathData.branchPoint.y + 4);
  }

  drawBranchStartPoints(pathData) {
    const currentTime = Date.now();
    
    pathData.branches.forEach((branch, index) => {
      const pulse = Math.sin(currentTime / 400 + index) * 0.2 + 0.8;
      
      // Draw pulsing circle at branch start point
      this.ctx.globalAlpha = pulse;
      this.ctx.fillStyle = '#FFD700'; // Gold for branch start point
      this.ctx.beginPath();
      this.ctx.arc(branch.branchPoint.x, branch.branchPoint.y, 6, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw branch start symbol
      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#8B4513';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('•', branch.branchPoint.x, branch.branchPoint.y + 3);
    });
    
    this.ctx.globalAlpha = 1.0;
  }

  drawMergeIndicators(pathData) {
    const path = pathData.points;
    const currentTime = Date.now();
    
    // Find potential merge points (look for sharp direction changes)
    const mergePoints = this.findMergePoints(path);
    
    // Draw merge indicators at these points
    mergePoints.forEach(point => {
      const pulse = Math.sin(currentTime / 300) * 0.3 + 0.7;
      
      // Draw pulsing circle at merge point
      this.ctx.globalAlpha = pulse;
      this.ctx.fillStyle = '#FFD700'; // Gold color for merge indicators
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw merge symbol
      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#8B4513';
      this.ctx.font = '16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('⚡', point.x, point.y + 5);
    });
    
    this.ctx.globalAlpha = 1.0;
  }

  findMergePoints(pathPoints) {
    const mergePoints = [];
    
    // Look for points where the path direction changes significantly
    // This indicates potential merge points
    for (let i = 1; i < pathPoints.length - 1; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      const next = pathPoints[i + 1];
      
      // Calculate angles
      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      
      // Calculate angle difference
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      // If angle change is significant, this might be a merge point
      if (angleDiff > Math.PI / 3) { // 60 degrees
        mergePoints.push(curr);
      }
    }
    
    return mergePoints;
  }

  drawPathAnimation(path, currentTime, pathIndex) {
    const animationSpeed = 100; // Speed of animation (pixels per second)
    const dotSpacing = 60; // Distance between animated dots
    const dotSize = 4; // Size of animated dots
    
    // Calculate total path length
    let totalLength = 0;
    const segmentLengths = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;
      const length = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(length);
      totalLength += length;
    }
    
    if (totalLength === 0) return;
    
    // Animation offset based on time and path index
    const timeOffset = pathIndex * 1000; // Stagger animations for different paths
    const animationOffset = ((currentTime + timeOffset) / 10) % dotSpacing;
    
    // Draw animated dots along the path
    for (let dotOffset = animationOffset; dotOffset < totalLength; dotOffset += dotSpacing) {
      const position = this.getPositionAlongPath(path, segmentLengths, dotOffset, totalLength);
      if (position) {
        // Draw animated dot
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, dotSize, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw direction arrow
        if (position.direction) {
          this.drawDirectionArrow(position.x, position.y, position.direction, dotSize * 1.5);
        }
      }
    }
  }

  getPositionAlongPath(path, segmentLengths, distance, totalLength) {
    if (distance >= totalLength) return null;
    
    let currentDistance = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const segmentLength = segmentLengths[i];
      
      if (currentDistance + segmentLength >= distance) {
        // Position is on this segment
        const segmentProgress = (distance - currentDistance) / segmentLength;
        const startPoint = path[i];
        const endPoint = path[i + 1];
        
        const x = startPoint.x + (endPoint.x - startPoint.x) * segmentProgress;
        const y = startPoint.y + (endPoint.y - startPoint.y) * segmentProgress;
        
        // Calculate direction
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const direction = Math.atan2(dy, dx);
        
        return { x, y, direction };
      }
      
      currentDistance += segmentLength;
    }
    
    return null;
  }

  drawDirectionArrow(x, y, direction, size) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(direction);
    
    // Draw simple arrow
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.beginPath();
    this.ctx.moveTo(size, 0);
    this.ctx.lineTo(-size/2, -size/2);
    this.ctx.lineTo(-size/2, size/2);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
  }

  darkenColor(color, amount) {
    // Simple color darkening function
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }

  drawTowerZones() {
    this.towerZones.forEach((zone, index) => {
      // Base zone appearance
      this.ctx.fillStyle = 'rgba(102, 204, 102, 0.3)'; // Light green with transparency
      this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      
      // Border
      this.ctx.strokeStyle = '#66cc66';
      this.ctx.setLineDash([3, 3]);
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      this.ctx.setLineDash([]);
      
      // Small center dot to indicate exact placement point
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      this.ctx.fillStyle = '#44aa44';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 2, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  drawBase() {
    // Use the base endpoint that matches server baseEndPoint (1200, 360)
    const baseX = 1200; // Matches server baseEndPoint.x
    const baseY = 360;  // Matches server baseEndPoint.y
    
    // Draw base
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(baseX - 20, baseY - 30, 40, 60);
    
    this.ctx.fillStyle = '#DC143C';
    this.ctx.fillRect(baseX - 15, baseY - 25, 30, 20);
    
    // Draw flag
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(baseX + 15, baseY - 25, 15, 10);
    
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(baseX + 15, baseY - 25);
    this.ctx.lineTo(baseX + 15, baseY - 40);
    this.ctx.stroke();
  }

  drawTowers(towers) {
    towers.forEach(tower => {
      this.drawTower(tower);
    });
  }

  drawTower(tower) {
    const towerType = TOWER_TYPES[tower.type];
    if (!towerType) return;

    // Check if we're applying an effect (show highlight)
    const isApplyingEffect = document.body.classList.contains('applying-effect');

    // Get quality color
    const qualityColors = {
      0: '#696969', // Normal (gris)
      1: '#4169E1', // Blue (bleu)
      2: '#9932CC', // Epic (violet)
      3: '#FFD700'  // Legendary (or)
    };
    const qualityColor = qualityColors[tower.qualityLevel] || '#696969';

    // Draw highlight for effect application
    if (isApplyingEffect) {
      this.ctx.strokeStyle = '#ffc107';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(tower.x - 18, tower.y - 18, 36, 36);
      this.ctx.setLineDash([]);
      this.ctx.lineWidth = 1;
    }

    // Draw tower base with quality color
    this.ctx.fillStyle = qualityColor;
    this.ctx.fillRect(tower.x - 15, tower.y - 15, 30, 30);
    
    // Draw tower top with type color
    this.ctx.fillStyle = towerType.color;
    this.ctx.fillRect(tower.x - 12, tower.y - 12, 24, 24);
    
    // Draw tower emoji/symbol
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(towerType.emoji, tower.x, tower.y + 7);
    
    // Draw range circle (semi-transparent)
    if (tower.range) {
      this.ctx.strokeStyle = towerType.color;
      this.ctx.setLineDash([3, 3]);
      this.ctx.lineWidth = 1;
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.arc(tower.x, tower.y, tower.range, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.setLineDash([]);
    }
    
    // Draw effects indicators
    if (tower.effects && tower.effects.length > 0) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillRect(tower.x + 10, tower.y - 20, 8, 8);
      this.ctx.fillStyle = '#000';
      this.ctx.font = '10px Arial';
      this.ctx.fillText(tower.effects.length, tower.x + 14, tower.y - 14);
    }

    // Draw quality level indicator
    if (tower.qualityLevel && tower.qualityLevel > 0) {
      this.ctx.fillStyle = qualityColor;
      for (let i = 0; i < tower.qualityLevel; i++) {
        this.ctx.fillRect(tower.x - 15 + (i * 4), tower.y - 25, 3, 3);
      }
    }
  }

  drawEnemies(enemies) {
    const currentTime = Date.now();
    
    enemies.forEach(enemy => {
      if (enemy.isSpawned) {
        this.drawEnemy(enemy);
      } else {
        // Dessiner un indicateur de spawn à venir
        this.drawSpawnIndicator(enemy, currentTime);
      }
    });
  }

  drawEnemy(enemy) {
    // Special visualization for healers
    if (enemy.types && enemy.types.includes('healer')) {
      this.drawHealerEnemy(enemy);
    } else {
      // Draw regular enemy body
      this.ctx.fillStyle = enemy.color || '#e74c3c';
      this.ctx.beginPath();
      this.ctx.arc(enemy.x, enemy.y, 10, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // Draw visual effects around enemy
    this.drawEnemyEffects(enemy);
    
    // Draw health bar
    const healthBarWidth = 20;
    const healthBarHeight = 4;
    const healthPercent = enemy.health / (enemy.maxHealth || enemy.health);
    
    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(enemy.x - healthBarWidth / 2, enemy.y - 20, healthBarWidth, healthBarHeight);
    
    // Health
    this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FF9800' : '#f44336';
    this.ctx.fillRect(enemy.x - healthBarWidth / 2, enemy.y - 20, healthBarWidth * healthPercent, healthBarHeight);
    
    // Draw enemy type indicators
    let indicatorY = enemy.y + 18;
    
    if (enemy.types) {
      enemy.types.forEach(type => {
        this.ctx.fillStyle = this.getTypeColor(type);
        this.ctx.fillRect(enemy.x - 8, indicatorY, 16, 3);
        indicatorY += 4;
      });
    }
    
    // Draw armor/resist indicators
    if (enemy.armor > 0) {
      this.ctx.fillStyle = '#95a5a6';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🛡️', enemy.x - 15, enemy.y);
    }
    
    if (enemy.magicResist > 0) {
      this.ctx.fillStyle = '#9b59b6';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🔮', enemy.x + 15, enemy.y);
    }
  }

  drawHealerEnemy(enemy) {
    const currentTime = Date.now();
    const pulse = Math.sin(currentTime / 300) * 0.2 + 0.8;
    
    // Draw healer body with pulsing effect
    this.ctx.fillStyle = enemy.color || '#1abc9c';
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 12 * pulse, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw healing aura
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#00FF00';
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, enemy.healRadius || 80, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
    
    // Draw healing cross symbol
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(enemy.x - 6, enemy.y);
    this.ctx.lineTo(enemy.x + 6, enemy.y);
    this.ctx.moveTo(enemy.x, enemy.y - 6);
    this.ctx.lineTo(enemy.x, enemy.y + 6);
    this.ctx.stroke();
    
    // Draw healing particles
    const numParticles = 4;
    for (let i = 0; i < numParticles; i++) {
      const angle = (i * 2 * Math.PI / numParticles) + currentTime / 500;
      const radius = 20 + Math.sin(currentTime / 200 + i) * 5;
      const particleX = enemy.x + Math.cos(angle) * radius;
      const particleY = enemy.y + Math.sin(angle) * radius;
      
      this.ctx.globalAlpha = 0.6 + Math.sin(currentTime / 300 + i) * 0.3;
      this.ctx.fillStyle = '#90EE90';
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 2, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    this.ctx.globalAlpha = 1.0;
  }

  drawEnemyEffects(enemy) {
    if (!enemy.effects) return;
    
    const currentTime = Date.now();
    
    // Draw all active effects
    Object.keys(enemy.effects).forEach(effectName => {
      const effect = enemy.effects[effectName];
      if (effect.visualEffect) {
        this.drawVisualEffect(enemy, effect.visualEffect, currentTime);
      }
    });
  }

  drawVisualEffect(enemy, visualEffect, currentTime) {
    const { type, color, particleColor, intensity, animation } = visualEffect;
    
    switch (type) {
      case 'fire':
        this.drawFireEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'ice':
        this.drawIceEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'acid':
        this.drawAcidEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'earth':
        this.drawEarthEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'wind':
        this.drawWindEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'heal':
        this.drawHealEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'anti_heal':
        this.drawAntiHealEffect(enemy, color, particleColor, intensity, currentTime);
        break;
    }
  }

  drawFireEffect(enemy, color, particleColor, intensity, currentTime) {
    // Flame particles around the enemy
    const numParticles = Math.floor(3 * intensity);
    const radius = 18;
    
    for (let i = 0; i < numParticles; i++) {
      const angle = (currentTime / 100 + i * 2 * Math.PI / numParticles) % (2 * Math.PI);
      const flicker = Math.sin(currentTime / 50 + i) * 0.3 + 0.7;
      const particleX = enemy.x + Math.cos(angle) * radius * flicker;
      const particleY = enemy.y + Math.sin(angle) * radius * flicker - 5;
      
      this.ctx.globalAlpha = 0.8 * flicker;
      this.ctx.fillStyle = Math.random() > 0.5 ? color : particleColor;
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 2 + Math.random() * 2, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Orange glow around enemy
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 16, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawIceEffect(enemy, color, particleColor, intensity, currentTime) {
    // Ice crystals around the enemy
    const numCrystals = Math.floor(4 * intensity);
    const radius = 16;
    
    for (let i = 0; i < numCrystals; i++) {
      const angle = i * 2 * Math.PI / numCrystals;
      const shimmer = Math.sin(currentTime / 200 + i) * 0.2 + 0.8;
      const crystalX = enemy.x + Math.cos(angle) * radius;
      const crystalY = enemy.y + Math.sin(angle) * radius;
      
      this.ctx.globalAlpha = 0.7 * shimmer;
      this.ctx.fillStyle = particleColor;
      this.ctx.fillRect(crystalX - 1, crystalY - 1, 2, 2);
      
      // Draw ice shard lines
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(crystalX - 3, crystalY - 3);
      this.ctx.lineTo(crystalX + 3, crystalY + 3);
      this.ctx.stroke();
    }
    
    // Blue tint around enemy
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 14, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawAcidEffect(enemy, color, particleColor, intensity, currentTime) {
    // Acid bubbles and corrosion
    const numBubbles = Math.floor(3 * intensity);
    
    for (let i = 0; i < numBubbles; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 15;
      const bubbleX = enemy.x + Math.cos(angle) * distance;
      const bubbleY = enemy.y + Math.sin(angle) * distance;
      const bubbleSize = Math.random() * 3 + 1;
      
      this.ctx.globalAlpha = 0.6;
      this.ctx.fillStyle = particleColor;
      this.ctx.beginPath();
      this.ctx.arc(bubbleX, bubbleY, bubbleSize, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Purple corrosion glow
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 15, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawEarthEffect(enemy, color, particleColor, intensity, currentTime) {
    // Rock particles and dust
    const numRocks = Math.floor(4 * intensity);
    const rumble = Math.sin(currentTime / 30) * 2;
    
    for (let i = 0; i < numRocks; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 12 + 8;
      const rockX = enemy.x + Math.cos(angle) * distance + rumble;
      const rockY = enemy.y + Math.sin(angle) * distance + rumble;
      
      this.ctx.globalAlpha = 0.8;
      this.ctx.fillStyle = i % 2 === 0 ? color : particleColor;
      this.ctx.fillRect(rockX - 1, rockY - 1, 3, 3);
    }
    
    // Brown dust cloud
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x + rumble, enemy.y + rumble, 18, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawWindEffect(enemy, color, particleColor, intensity, currentTime) {
    // Swirling wind particles
    const numParticles = Math.floor(5 * intensity);
    const swirl = currentTime / 100;
    
    for (let i = 0; i < numParticles; i++) {
      const baseAngle = i * 2 * Math.PI / numParticles;
      const angle = baseAngle + swirl + Math.sin(swirl + i) * 0.5;
      const distance = 12 + Math.sin(swirl * 2 + i) * 6;
      const particleX = enemy.x + Math.cos(angle) * distance;
      const particleY = enemy.y + Math.sin(angle) * distance;
      
      this.ctx.globalAlpha = 0.7;
      this.ctx.fillStyle = i % 2 === 0 ? color : particleColor;
      
      // Draw small wind streaks
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 1, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw motion trails
      const trailX = particleX - Math.cos(angle) * 5;
      const trailY = particleY - Math.sin(angle) * 5;
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(trailX, trailY);
      this.ctx.lineTo(particleX, particleY);
      this.ctx.stroke();
    }
    
    // Green wind aura
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 20, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawProjectiles(projectiles) {
    projectiles.forEach(projectile => {
      this.drawProjectile(projectile);
    });
  }

  drawProjectile(projectile) {
    const color = this.getProjectileColor(projectile.effect);
    
    // Draw projectile trail
    this.ctx.globalAlpha = 0.5;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 8, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // Draw projectile core
    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add glow effect
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 10, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  getProjectileColor(effect) {
    switch (effect) {
      case 'dot': return '#FF4500'; // Fire/Feu
      case 'slow': return '#87CEEB'; // Ice/Glace
      case 'armor_reduction': return '#9400D3'; // Acid/Acide
      case 'aoe': return '#8B4513'; // Earth/Terre
      case 'vortex': return '#32CD32'; // Wind/Vent
      case 'none': return '#2C2C2C'; // Shadow/Ténèbres
      default: return '#FFD700'; // Default gold
    }
  }

  // Utility method to check if point is in tower zone
  isPointInTowerZone(x, y) {
    return this.towerZones.some(zone => 
      x >= zone.x && x <= zone.x + zone.width &&
      y >= zone.y && y <= zone.y + zone.height
    );
  }

  isClickInTowerZone(x, y) {
    return this.towerZones.some(zone => 
      x >= zone.x && 
      x <= zone.x + zone.width && 
      y >= zone.y && 
      y <= zone.y + zone.height
    );
  }

  getNearestTowerZone(x, y) {
    let nearestZone = null;
    let minDistance = Infinity;
    
    this.towerZones.forEach(zone => {
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = { x: centerX, y: centerY, zone };
      }
    });
    
    return nearestZone;
  }

  getTypeColor(type) {
    switch(type) {
      case 'normal': return '#27ae60';
      case 'armored': return '#95a5a6';
      case 'fast': return '#f39c12';
      case 'magical': return '#9b59b6';
      case 'invisible': return '#34495e';
      case 'healer': return '#1abc9c';
      default: return '#e74c3c';
    }
  }

  drawSpawnIndicator(enemy, currentTime) {
    if (!enemy.spawnTime) return;
    
    const timeLeft = enemy.spawnTime - currentTime;
    if (timeLeft <= 0) return;
    
    // Draw a small indicator at spawn point
    const spawnX = 0;
    const spawnY = 300;
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.beginPath();
    this.ctx.arc(spawnX, spawnY, 5, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw countdown
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(Math.ceil(timeLeft/1000), spawnX, spawnY - 10);
  }

  drawWaveInfo(gameState) {
    if (!gameState || !gameState.enemies) return;
    
    const spawnedCount = gameState.enemies.filter(e => e.isSpawned).length;
    const totalCount = gameState.enemies.length;
    const remainingCount = totalCount - spawnedCount;
    
    // Afficher les stats de la vague en haut à droite (UI fixe)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.viewportWidth - 200, 10, 190, 60);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Vague ${gameState.currentWave || 1}`, this.viewportWidth - 190, 30);
    this.ctx.fillText(`Spawned: ${spawnedCount}/${totalCount}`, this.viewportWidth - 190, 45);
    this.ctx.fillText(`À venir: ${remainingCount}`, this.viewportWidth - 190, 60);
  }

  drawCameraInfo() {
    // Draw camera debug info (UI element, not affected by camera)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 200, 80);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Camera: (${Math.round(this.camera.x)}, ${Math.round(this.camera.y)})`, 15, 25);
    this.ctx.fillText(`Map: ${this.mapWidth}x${this.mapHeight}`, 15, 40);
    this.ctx.fillText(`Viewport: ${this.viewportWidth}x${this.viewportHeight}`, 15, 55);
    this.ctx.fillText(`Controls: Arrows, Middle-click drag`, 15, 70);
    this.ctx.fillText(`Paths: ${this.paths.length}`, 15, 85);
  }

  // === GRID SYSTEM ===
  
  drawGrid() {
    const cellSize = this.gridCellSize;
    
    // Calculate visible grid area
    const worldTopLeft = this.screenToWorld(0, 0);
    const worldBottomRight = this.screenToWorld(this.viewportWidth, this.viewportHeight);
    
    const startX = Math.floor(worldTopLeft.x / cellSize) * cellSize;
    const startY = Math.floor(worldTopLeft.y / cellSize) * cellSize;
    const endX = Math.ceil(worldBottomRight.x / cellSize) * cellSize;
    const endY = Math.ceil(worldBottomRight.y / cellSize) * cellSize;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    
    // Lignes verticales (optimized for visible area)
    for (let x = startX; x <= endX; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }
    
    // Lignes horizontales (optimized for visible area)
    for (let y = startY; y <= endY; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  drawPreviewHitbox() {
    if (!this.previewPosition) return;
    
    const gridPos = this.snapToGrid(this.previewPosition.x, this.previewPosition.y);
    const isValid = this.isValidGridPosition(gridPos.x, gridPos.y);
    
    // Couleur selon la validité
    const color = isValid ? '#00ff00' : '#ff0000';
    this.ctx.fillStyle = color + 'B3'; // 70% opacity
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    
    // Dessiner la hitbox
    const halfSize = this.gridCellSize / 2;
    this.ctx.fillRect(
      gridPos.x - halfSize, 
      gridPos.y - halfSize, 
      this.gridCellSize, 
      this.gridCellSize
    );
    this.ctx.strokeRect(
      gridPos.x - halfSize, 
      gridPos.y - halfSize, 
      this.gridCellSize, 
      this.gridCellSize
    );
  }

  snapToGrid(x, y) {
    const cellSize = this.gridCellSize;
    const gridX = Math.round(x / cellSize) * cellSize;
    const gridY = Math.round(y / cellSize) * cellSize;
    return { x: gridX, y: gridY };
  }

  isValidGridPosition(x, y) {
    // Vérifier les limites de la map (pas du canvas)
    const halfSize = this.gridCellSize / 2;
    if (x - halfSize < 0 || x + halfSize > this.mapWidth || 
        y - halfSize < 0 || y + halfSize > this.mapHeight) {
      return false;
    }
    
    // Vérifier la distance du chemin
    if (!this.isValidDistanceFromPath(x, y)) {
      return false;
    }
    
    // Vérifier les tours existantes
    if (this.gameState && this.gameState.towers) {
      for (const tower of this.gameState.towers) {
        const distance = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
        if (distance < this.gridCellSize) {
          return false;
        }
      }
    }
    
    return true;
  }

  isValidDistanceFromPath(x, y) {
    let minDistance = Infinity;
    
    // Check distance to all paths, not just the first one
    this.paths.forEach(pathData => {
      const path = pathData.points;
      for (let i = 0; i < path.length - 1; i++) {
        const point1 = path[i];
        const point2 = path[i + 1];
        const distance = this.distanceToLineSegment(x, y, point1.x, point1.y, point2.x, point2.y);
        minDistance = Math.min(minDistance, distance);
      }
    });
    
    return minDistance >= 30 && minDistance <= 120; // 30 = PATH_BUFFER
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Méthodes publiques pour l'interface
  startTowerPlacement() {
    console.log('🎯 Starting tower placement mode');
    this.showGrid = true;
  }

  stopTowerPlacement() {
    console.log('🛑 Stopping tower placement mode');
    this.showGrid = false;
    this.previewPosition = null;
  }

  updatePreviewPosition(x, y) {
    this.previewPosition = { x, y };
    console.log('👆 Preview position updated:', x, y, 'showGrid:', this.showGrid, 'previewPos:', this.previewPosition);
  }

  getSnappedPosition(x, y) {
    const snapped = this.snapToGrid(x, y);
    const isValid = this.isValidGridPosition(snapped.x, snapped.y);
    console.log('📍 Snap check:', { x, y }, '→', snapped, 'valid:', isValid);
    return isValid ? snapped : null;
  }

  // Check if chat is currently active/focused
  isChatActive() {
    const chatInput = document.getElementById('chatInput');
    return chatInput && document.activeElement === chatInput;
  }
}
