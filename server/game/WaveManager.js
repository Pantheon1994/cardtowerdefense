const { ENEMY_TYPES } = require('../constants/events');

class WaveManager {
  constructor() {
    this.enemyTemplates = {
      goblin: {
        name: "Gobelin",
        health: 100,
        speed: 50,
        armor: 0,
        magicResist: 0,
        reward: 10,
        color: "#27ae60",
        types: [ENEMY_TYPES.NORMAL]
      },
      orc: {
        name: "Orc",
        health: 150,
        speed: 40,
        armor: 5,
        magicResist: 0,
        reward: 15,
        color: "#e74c3c",
        types: [ENEMY_TYPES.ARMORED]
      },
      scout: {
        name: "Éclaireur",
        health: 80,
        speed: 80,
        armor: 0,
        magicResist: 0,
        reward: 12,
        color: "#f39c12",
        types: [ENEMY_TYPES.FAST]
      },
      mage: {
        name: "Mage",
        health: 120,
        speed: 45,
        armor: 0,
        magicResist: 50,
        reward: 20,
        color: "#9b59b6",
        types: [ENEMY_TYPES.MAGICAL]
      },
      assassin: {
        name: "Assassin",
        health: 90,
        speed: 60,
        armor: 0,
        magicResist: 0,
        reward: 18,
        color: "#34495e",
        types: [ENEMY_TYPES.INVISIBLE]
      },
      armored_scout: {
        name: "Éclaireur Blindé",
        health: 110,
        speed: 65,
        armor: 3,
        magicResist: 0,
        reward: 25,
        color: "#e67e22",
        types: [ENEMY_TYPES.FAST, ENEMY_TYPES.ARMORED]
      },
      healer: {
        name: "Guérisseur",
        health: 150,
        speed: 35,
        armor: 2,
        magicResist: 30,
        reward: 30,
        color: "#1abc9c",
        types: [ENEMY_TYPES.HEALER],
        healRadius: 80, // Rayon de soin
        healAmount: 15, // Montant de base du soin
        healInterval: 2000, // Intervalle entre les soins (2 secondes)
        lastHealTime: 0
      }
    };
    
    // Map expansion system
    this.mapWidth = 1280;
    this.mapHeight = 720;
    this.baseMapWidth = 1280;
    this.baseMapHeight = 720;
    this.expansionSize = 200; // Expand by 200 pixels each time
    
    // Path system
    this.paths = [];
    this.baseEndPoint = { x: 1200, y: 360 }; // All paths lead here (near right edge, centered vertically)
    this.initializePaths();
  }

  initializePaths() {
    // Initialize with the first path (scaled for 1280x720)
    this.paths = [
      {
        id: 'path_0',
        createdAtWave: 1,
        points: [
          { x: 0, y: 360 },      // Start at middle left
          { x: 320, y: 360 },    // Move right
          { x: 320, y: 240 },    // Move up
          { x: 640, y: 240 },    // Move right
          { x: 640, y: 480 },    // Move down
          { x: 960, y: 480 },    // Move right
          { x: 960, y: 360 },    // Move up to center
          { x: 1200, y: 360 }    // End at base (near right edge, center)
        ]
      }
    ];
  }

  shouldExpandMap(waveNumber) {
    return waveNumber > 1 && waveNumber % 5 === 1; // Waves 6, 11, 16, 21, etc.
  }

  expandMapAndAddPath(waveNumber) {
    if (!this.shouldExpandMap(waveNumber)) return null;
    
    console.log(`🗺️ Expanding map for wave ${waveNumber}`);
    
    // Expand map dimensions
    this.mapWidth += this.expansionSize;
    this.mapHeight += this.expansionSize;
    
    // Try to generate new path
    const pathResult = this.generateNewPath(waveNumber);
    
    // If no valid path could be generated, don't add it
    if (!pathResult) {
      return null;
    }
    
    // Check if the result is a branched path (new path that branches from existing)
    if (pathResult && pathResult.branchedFrom) {
      // This is a branched path, add it to the paths array
      this.paths.push(pathResult);
      return pathResult;
    }
    
    // Check if the result is an existing path (shouldn't happen with branching)
    const existingPathIndex = this.paths.findIndex(p => p.id === pathResult.id);
    if (existingPathIndex !== -1) {
      // This shouldn't happen with branching, but handle it just in case
      return pathResult;
    }
    
    // This is a completely new path, add it to the paths array
    this.paths.push(pathResult);
    
    return pathResult;
  }

  generateNewPath(waveNumber) {
    const pathId = `path_${this.paths.length}`;
    
    let attempts = 0;
    let newPath = null;
    const maxAttempts = 20; // Augmenté pour plus de tentatives
    
    // Try to generate a path that doesn't intersect with existing paths
    while (attempts < maxAttempts) {
      // Generate more varied starting points using the expanded area - keeping them within reasonable bounds
      const startingPoints = [
        // Top edge - nouvelle zone (mais pas aux coins extrêmes)
        { x: Math.random() * (this.mapWidth - 200) + 100, y: 0 },
        // Bottom edge - nouvelle zone
        { x: Math.random() * (this.mapWidth - 200) + 100, y: this.mapHeight },
        // Left edge - nouvelle zone
        { x: 0, y: Math.random() * this.mapHeight },
        // Right edge - nouvelle zone (mais pas trop près du point de base)
        { x: this.mapWidth, y: Math.random() * this.mapHeight },
        // Some strategic middle points for variety
        { x: 0, y: this.mapHeight / 4 },
        { x: 0, y: this.mapHeight * 3/4 },
        { x: this.mapWidth / 4, y: 0 },
        { x: this.mapWidth * 3/4, y: 0 }
      ];
      
      const startPoint = startingPoints[Math.floor(Math.random() * startingPoints.length)];
      const pathPoints = this.generatePathPoints(startPoint, this.baseEndPoint, waveNumber, attempts);
      
      const tempPath = {
        id: pathId,
        createdAtWave: waveNumber,
        points: pathPoints,
        destroyedTowers: []
      };
      
      // First, check if this path can branch with an existing path
      const branchResult = this.canBranchWithExistingPaths(tempPath);
      if (branchResult.canBranch) {
        const branchedPath = this.createBranchedPath(tempPath, branchResult.existingPath, branchResult.branchPoint);
        return branchedPath; // Return the branched path immediately
      }
        // If can't branch, check if this path intersects with existing paths (less priority)
      if (!this.pathIntersectsWithExisting(tempPath)) {
        newPath = tempPath;
        break;
      }

      attempts++;
    }
    
    // If we couldn't generate a non-intersecting path, try fallback strategy
    if (!newPath) {
      const fallbackPath = this.generateFallbackPath(waveNumber, pathId);
      
      // Check if fallback path can branch
      const branchResult = this.canBranchWithExistingPaths(fallbackPath);
      if (branchResult.canBranch) {
        return this.createBranchedPath(fallbackPath, branchResult.existingPath, branchResult.branchPoint);
      }
      
      newPath = fallbackPath;
    }
    
    return newPath;
  }

  // Check if a path intersects with existing paths
  pathIntersectsWithExisting(newPath) {
    const intersectionThreshold = 60; // Augmenté pour plus d'espacement
    
    for (const existingPath of this.paths) {
      if (this.pathsIntersect(newPath.points, existingPath.points, intersectionThreshold)) {
        return true;
      }
    }
    
    return false;
  }

  // Check if a path can branch with existing paths
  canBranchWithExistingPaths(newPath) {
    const branchThreshold = 40; // Distance pour considérer un branchement (réduit pour être plus sensible)
    
    for (const existingPath of this.paths) {
      const branchPoint = this.findBranchPoint(newPath.points, existingPath.points, branchThreshold);
      if (branchPoint) {
        return {
          canBranch: true,
          existingPath: existingPath,
          branchPoint: branchPoint
        };
      }
    }
    
    return { canBranch: false };
  }

  // Find if a new path can branch from an existing path
  findBranchPoint(newPathPoints, existingPathPoints, threshold) {
    // Check each point of the new path to see if it's close to any segment of the existing path
    // Start from index 1 to keep the starting point of the new path unique
    for (let i = 1; i < newPathPoints.length; i++) {
      const newPoint = newPathPoints[i];
      
      // Check distance to each segment of the existing path
      for (let j = 0; j < existingPathPoints.length - 1; j++) {
        const segStart = existingPathPoints[j];
        const segEnd = existingPathPoints[j + 1];
        
        const distance = this.distanceFromPointToLineSegment(
          newPoint.x, newPoint.y,
          segStart.x, segStart.y,
          segEnd.x, segEnd.y
        );
        
        if (distance < threshold) {
          // Found a potential branch point
          const branchCoordinates = this.getClosestPointOnSegment(
            newPoint.x, newPoint.y,
            segStart.x, segStart.y,
            segEnd.x, segEnd.y
          );
          
          return {
            newPathIndex: i,
            existingPathSegmentIndex: j,
            branchCoordinates: branchCoordinates,
            distance: distance
          };
        }
      }
    }
    
    return null;
  }

  // Create a branched path that connects to an existing path
  createBranchedPath(newPath, existingPath, branchInfo) {
    // Create the branched path points - ONLY up to the branch point (where it connects)
    const branchedPoints = [];
    
    // Add points from new path up to (but NOT including) the branch connection point
    for (let i = 0; i < branchInfo.newPathIndex; i++) {
      branchedPoints.push(newPath.points[i]);
    }
    
    // Add the exact branch connection point as the final point (where this path connects to the existing one)
    branchedPoints.push(branchInfo.branchCoordinates);
    
    // Create the new branched path - stops exactly at the connection point
    const branchedPath = {
      id: newPath.id,
      createdAtWave: newPath.createdAtWave,
      points: branchedPoints, // Visual path stops at connection point
      destroyedTowers: [],
      branchedFrom: existingPath.id,
      branchPoint: branchInfo.branchCoordinates,
      branchSegmentIndex: branchInfo.existingPathSegmentIndex,
      // Store the complete path for enemy movement (includes continuation to base)
      fullEnemyPath: this.createFullEnemyPath(branchedPoints, existingPath.points, branchInfo)
    };
    
    // Add branch info to the existing path (the existing path is NOT modified)
    if (!existingPath.branches) {
      existingPath.branches = [];
    }
    existingPath.branches.push({
      pathId: newPath.id,
      branchPoint: branchInfo.branchCoordinates,
      branchAtWave: newPath.createdAtWave,
      segmentIndex: branchInfo.existingPathSegmentIndex
    });
    
    return branchedPath;
  }

  // Create the full path that enemies will follow (visual path + continuation to base)
  createFullEnemyPath(branchPoints, existingPathPoints, branchInfo) {
    const fullPath = [...branchPoints]; // Start with the branch path
    
    // Continue along the existing path from the branch point to the end
    for (let i = branchInfo.existingPathSegmentIndex + 1; i < existingPathPoints.length; i++) {
      fullPath.push(existingPathPoints[i]);
    }
    
    return fullPath;
  }

  // Check if two paths intersect or are too close
  pathsIntersect(path1Points, path2Points, threshold) {
    // Check each point of path1 against entire path2
    for (let i = 0; i < path1Points.length; i++) {
      const point = path1Points[i];
      
      // Check distance from this point to the entire existing path
      let minDistance = Infinity;
      for (let j = 0; j < path2Points.length - 1; j++) {
        const seg2Start = path2Points[j];
        const seg2End = path2Points[j + 1];
        
        const distance = this.distanceFromPointToLineSegment(
          point.x, point.y,
          seg2Start.x, seg2Start.y,
          seg2End.x, seg2End.y
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      if (minDistance < threshold) {
        return true;
      }
    }
    
    return false;
  }

  // Calculate distance between two line segments
  distanceBetweenSegments(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Calculate all point-to-segment distances
    const distances = [
      this.distanceFromPointToLineSegment(x1, y1, x3, y3, x4, y4),
      this.distanceFromPointToLineSegment(x2, y2, x3, y3, x4, y4),
      this.distanceFromPointToLineSegment(x3, y3, x1, y1, x2, y2),
      this.distanceFromPointToLineSegment(x4, y4, x1, y1, x2, y2)
    ];
    
    return Math.min(...distances);
  }

  // Fallback path generation strategy
  generateFallbackPath(waveNumber, pathId) {
    // Use predefined paths that are guaranteed not to intersect
    const fallbackPaths = [
      // Simple L-shaped paths from different edges
      [
        { x: 0, y: this.mapHeight / 4 },
        { x: this.mapWidth / 3, y: this.mapHeight / 4 },
        { x: this.mapWidth / 3, y: this.baseEndPoint.y },
        { x: this.baseEndPoint.x, y: this.baseEndPoint.y }
      ],
      [
        { x: this.mapWidth - 50, y: this.mapHeight * 3/4 },  // Start slightly inside the edge
        { x: this.mapWidth * 2/3, y: this.mapHeight * 3/4 },
        { x: this.mapWidth * 2/3, y: this.baseEndPoint.y },
        { x: this.baseEndPoint.x, y: this.baseEndPoint.y }
      ],
      [
        { x: this.mapWidth / 2, y: 0 },
        { x: this.mapWidth / 2, y: this.mapHeight / 3 },
        { x: this.baseEndPoint.x, y: this.mapHeight / 3 },
        { x: this.baseEndPoint.x, y: this.baseEndPoint.y }
      ],
      [
        { x: this.mapWidth / 2, y: this.mapHeight - 50 },  // Start slightly inside the edge
        { x: this.mapWidth / 2, y: this.mapHeight * 2/3 },
        { x: this.baseEndPoint.x, y: this.mapHeight * 2/3 },
        { x: this.baseEndPoint.x, y: this.baseEndPoint.y }
      ]
    ];
    
    const pathIndex = (this.paths.length - 1) % fallbackPaths.length;
    const selectedPath = fallbackPaths[pathIndex];
    
    return {
      id: pathId,
      createdAtWave: waveNumber,
      points: selectedPath,
      destroyedTowers: []
    };
  }

  generatePathPoints(startPoint, endPoint, waveNumber, attemptNumber = 0) {
    const points = [{ x: startPoint.x, y: startPoint.y }];
    
    let currentX = startPoint.x;
    let currentY = startPoint.y;
    
    const SEGMENT_LENGTH = 120; // Longueur minimale des segments
    const numTurns = 2 + Math.floor(Math.random() * 3); // 2-4 virages
    
    for (let i = 0; i < numTurns; i++) {
      const progress = (i + 1) / (numTurns + 1);
      
      // Point cible intermédiaire
      const targetX = startPoint.x + (endPoint.x - startPoint.x) * progress;
      const targetY = startPoint.y + (endPoint.y - startPoint.y) * progress;
      
      // Décider si on va horizontalement ou verticalement
      const deltaX = targetX - currentX;
      const deltaY = targetY - currentY;
      
      // Alternance forcée : horizontal puis vertical
      if (i % 2 === 0) {
        // Mouvement horizontal d'abord
        if (Math.abs(deltaX) > SEGMENT_LENGTH) {
          const newX = currentX + (deltaX > 0 ? 
            Math.min(Math.abs(deltaX), SEGMENT_LENGTH + Math.random() * 100) : 
            -Math.min(Math.abs(deltaX), SEGMENT_LENGTH + Math.random() * 100));
          
          points.push({ x: Math.max(50, Math.min(this.mapWidth - 50, newX)), y: currentY });
          currentX = points[points.length - 1].x;
        }
        
        // Puis mouvement vertical
        if (Math.abs(deltaY) > SEGMENT_LENGTH) {
          const newY = currentY + (deltaY > 0 ? 
            Math.min(Math.abs(deltaY), SEGMENT_LENGTH + Math.random() * 100) : 
            -Math.min(Math.abs(deltaY), SEGMENT_LENGTH + Math.random() * 100));
          
          points.push({ x: currentX, y: Math.max(50, Math.min(this.mapHeight - 50, newY)) });
          currentY = points[points.length - 1].y;
        }
      } else {
        // Mouvement vertical d'abord
        if (Math.abs(deltaY) > SEGMENT_LENGTH) {
          const newY = currentY + (deltaY > 0 ? 
            Math.min(Math.abs(deltaY), SEGMENT_LENGTH + Math.random() * 100) : 
            -Math.min(Math.abs(deltaY), SEGMENT_LENGTH + Math.random() * 100));
          
          points.push({ x: currentX, y: Math.max(50, Math.min(this.mapHeight - 50, newY)) });
          currentY = points[points.length - 1].y;
        }
        
        // Puis mouvement horizontal
        if (Math.abs(deltaX) > SEGMENT_LENGTH) {
          const newX = currentX + (deltaX > 0 ? 
            Math.min(Math.abs(deltaX), SEGMENT_LENGTH + Math.random() * 100) : 
            -Math.min(Math.abs(deltaX), SEGMENT_LENGTH + Math.random() * 100));
          
          points.push({ x: Math.max(50, Math.min(this.mapWidth - 50, newX)), y: currentY });
          currentX = points[points.length - 1].x;
        }
      }
    }
    
    // Approche finale - toujours orthogonale
    if (Math.abs(endPoint.x - currentX) > 10) {
      points.push({ x: endPoint.x, y: currentY });
      currentX = endPoint.x;
    }
    if (Math.abs(endPoint.y - currentY) > 10) {
      points.push({ x: currentX, y: endPoint.y });
      currentY = endPoint.y;
    }
    
    // Point final exactement à destination
    if (currentX !== endPoint.x || currentY !== endPoint.y) {
      points.push({ x: endPoint.x, y: endPoint.y });
    }
    
    return points;
  }

  checkAndDestroyTowers(newPath, towers) {
    const destroyedTowers = [];
    const pathWidth = 30; // Width of the path that destroys towers
    
    for (const [towerId, tower] of towers) {
      if (this.isTowerOnPath(tower, newPath.points, pathWidth)) {
        destroyedTowers.push({
          id: towerId,
          x: tower.x,
          y: tower.y,
          type: tower.type,
          playerId: tower.playerId
        });
      }
    }
    
    // Remove destroyed towers from the map
    destroyedTowers.forEach(towerInfo => {
      towers.delete(towerInfo.id);
    });
    
    newPath.destroyedTowers = destroyedTowers;
    
    return destroyedTowers;
  }

  isTowerOnPath(tower, pathPoints, pathWidth) {
    // Check if tower is within pathWidth distance of any path segment
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const segmentStart = pathPoints[i];
      const segmentEnd = pathPoints[i + 1];
      
      const distance = this.distanceFromPointToLineSegment(
        tower.x, tower.y,
        segmentStart.x, segmentStart.y,
        segmentEnd.x, segmentEnd.y
      );
      
      if (distance <= pathWidth) {
        return true;
      }
    }
    return false;
  }

  distanceFromPointToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // Degenerate case: the segment is a point
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
  }

  // Get the closest point on a line segment to a given point
  getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return { x: x1, y: y1 };
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    return {
      x: x1 + t * dx,
      y: y1 + t * dy
    };
  }

  getAllPaths() {
    return this.paths;
  }

  getRandomPath() {
    return this.paths[Math.floor(Math.random() * this.paths.length)];
  }

  getPathForWave(waveNumber) {
    // Retourne un chemin aléatoire parmi tous les chemins disponibles
    const randomPath = this.getRandomPath();
    return randomPath.points;
  }

  // Méthode pour obtenir les chemins pour le rendu visuel (s'arrêtent aux connexions)
  getVisualPathsForWave(waveNumber) {
    return this.paths.map(path => ({
      id: path.id,
      points: path.points, // Points visuels (s'arrêtent aux connexions pour les chemins branchés)
      createdAtWave: path.createdAtWave,
      branchedFrom: path.branchedFrom,
      branchPoint: path.branchPoint,
      branches: path.branches || []
    }));
  }

  // Méthode pour obtenir tous les chemins disponibles pour une vague (mouvement des ennemis)
  getAllPathsForWave(waveNumber) {
    return this.paths.map(path => {
      // For branched paths, use the full enemy path; for regular paths, use normal points
      if (path.fullEnemyPath) {
        return path.fullEnemyPath; // Use the complete path for enemies
      } else {
        return path.points; // Use normal points for non-branched paths
      }
    });
  }

  getMapDimensions() {
    return {
      width: this.mapWidth,
      height: this.mapHeight
    };
  }

  getWaveEnemies(waveNumber) {
    const enemies = [];
    const waveConfig = this.generateWaveConfig(waveNumber);
    const allPaths = this.getAllPathsForWave(waveNumber); // Obtenir tous les chemins disponibles
    
    let totalEnemyCount = 0;
    waveConfig.enemies.forEach(enemyConfig => {
      totalEnemyCount += enemyConfig.count;
    });
    
    let currentEnemyIndex = 0;
    
    waveConfig.enemies.forEach((enemyConfig, groupIndex) => {
      const template = this.enemyTemplates[enemyConfig.type];
      if (template) {
        for (let i = 0; i < enemyConfig.count; i++) {
          // Distribuer les ennemis sur tous les chemins disponibles
          const pathIndex = currentEnemyIndex % allPaths.length;
          const selectedPath = allPaths[pathIndex];
          
          const enemy = {
            ...template,
            id: `wave${waveNumber}_${enemyConfig.type}_${i}`,
            // Spawn delay for staggered spawning
            spawnDelay: currentEnemyIndex * 1200, // 1.2 secondes entre chaque
            health: Math.floor(template.health * waveConfig.healthMultiplier),
            armor: Math.floor(template.armor * waveConfig.armorMultiplier),
            magicResist: Math.floor(template.magicResist * waveConfig.resistMultiplier),
            // Initialize movement properties - will be set when spawned
            x: selectedPath[0].x,
            y: selectedPath[0].y,
            currentPathIndex: 0,
            isSpawned: false, // Will spawn with delay
            maxHealth: Math.floor(template.health * waveConfig.healthMultiplier),
            effects: {},
            spawnTime: null, // Will be set when wave starts
            pathPoints: selectedPath // Stocke le chemin spécifique pour cet ennemi
          };
          
          // Add movement methods
          enemy.move = this.createMoveFunction(enemy);
          enemy.hasReachedBase = () => enemy.currentPathIndex >= selectedPath.length - 1;
          
          enemies.push(enemy);
          currentEnemyIndex++;
        }
      }
    });

    return enemies;
  }

  spawnWave(waveNumber) {
    const enemies = this.getWaveEnemies(waveNumber);
    
    // Add spawn timing and position
    enemies.forEach(enemy => {
      enemy.x = enemy.pathPoints[0].x; // Start position (already set in getWaveEnemies)
      enemy.y = enemy.pathPoints[0].y; // Start position (already set in getWaveEnemies)
      enemy.currentPathIndex = 0;
      enemy.spawnTime = Date.now() + enemy.spawnDelay;
      enemy.isSpawned = false;
      enemy.maxHealth = enemy.health; // Store original health
      enemy.effects = {}; // Initialize effects
      enemy.pathPoints = [...enemy.pathPoints]; // Store a copy of the path for this enemy (immutable)
      enemy.assignedPathId = this.getPathIdForPoints(enemy.pathPoints); // Store which path this enemy is using
      
      // Add movement methods
      enemy.move = this.createMoveFunction(enemy);
      enemy.hasReachedBase = () => enemy.currentPathIndex >= enemy.pathPoints.length - 1;
    });

    return enemies;
  }

  // Helper function to identify which path corresponds to given points
  getPathIdForPoints(points) {
    for (const path of this.paths) {
      // Check against visual path points first
      if (path.points.length === points.length) {
        let isMatch = true;
        for (let i = 0; i < points.length; i++) {
          if (Math.abs(path.points[i].x - points[i].x) > 1 || 
              Math.abs(path.points[i].y - points[i].y) > 1) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) return path.id;
      }
      
      // Check against full enemy path for branched paths
      if (path.fullEnemyPath && path.fullEnemyPath.length === points.length) {
        let isMatch = true;
        for (let i = 0; i < points.length; i++) {
          if (Math.abs(path.fullEnemyPath[i].x - points[i].x) > 1 || 
              Math.abs(path.fullEnemyPath[i].y - points[i].y) > 1) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) return path.id;
      }
    }
    return 'unknown';
  }

  generateWaveConfig(waveNumber) {
    const baseConfig = {
      healthMultiplier: 1 + (waveNumber - 1) * 0.15,
      armorMultiplier: 1 + (waveNumber - 1) * 0.1,
      resistMultiplier: 1 + (waveNumber - 1) * 0.05,
      enemies: []
    };

    // Define enemy composition based on wave number
    if (waveNumber <= 3) {
      // Early waves: mostly normal enemies
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(5 + waveNumber * 2) }
      ];
    } else if (waveNumber <= 6) {
      // Mid waves: introduce armored and fast
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(3 + waveNumber) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 3) }
      ];
    } else if (waveNumber <= 10) {
      // Advanced waves: add magical and invisible
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(2 + waveNumber / 2) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 2) },
        { type: 'mage', count: Math.floor(waveNumber / 4) },
        { type: 'assassin', count: Math.floor(waveNumber / 5) },
        { type: 'healer', count: Math.floor(waveNumber / 8) } // Healers apparaissent plus tard
      ];
    } else {
      // Boss waves: mixed types including combinations
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(waveNumber / 2) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 3) },
        { type: 'mage', count: Math.floor(waveNumber / 3) },
        { type: 'assassin', count: Math.floor(waveNumber / 4) },
        { type: 'armored_scout', count: Math.floor(waveNumber / 6) },
        { type: 'healer', count: Math.floor(waveNumber / 5) } // Plus de healers dans les vagues boss
      ];
    }

    return baseConfig;
  }

  createMoveFunction(enemy) {
    return function() {
      // Only move if spawned
      if (!this.isSpawned) return;

      // Use the immutable stored path for this enemy
      const path = this.pathPoints;
      if (!path || this.currentPathIndex >= path.length - 1) return;

      const currentTarget = path[this.currentPathIndex + 1];
      if (!currentTarget) return;

      const dx = currentTarget.x - this.x;
      const dy = currentTarget.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        this.currentPathIndex++;
        return;
      }

      let effectiveSpeed = this.speed;
      
      // Apply slow effect if present
      if (this.effects && this.effects.slowed) {
        const slowEffect = this.effects.slowed;
        if (Date.now() - slowEffect.appliedAt < slowEffect.duration) {
          effectiveSpeed *= slowEffect.slowAmount;
        } else {
          delete this.effects.slowed;
        }
      }

      const moveDistance = effectiveSpeed / 60; // 60 FPS
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    }.bind(enemy);
  }

  // Méthode de compatibilité pour l'ancien système
  getPath() {
    return this.paths[0].points; // Return the first path for compatibility
  }

  getExpansionInfo() {
    const latestPath = this.paths[this.paths.length - 1];
    // Create visual version of the latest path
    const visualLatestPath = latestPath ? {
      id: latestPath.id,
      points: latestPath.points, // Visual points (stop at connection for branched paths)
      createdAtWave: latestPath.createdAtWave,
      branchedFrom: latestPath.branchedFrom,
      branchPoint: latestPath.branchPoint,
      branches: latestPath.branches || [],
      destroyedTowers: latestPath.destroyedTowers
    } : null;
    
    return {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      mapDimensions: {
        width: this.mapWidth,
        height: this.mapHeight
      },
      newPath: visualLatestPath,
      allPaths: this.getVisualPathsForWave(1), // Get visual paths for rendering
      destroyedTowers: latestPath ? latestPath.destroyedTowers : []
    };
  }
}

module.exports = WaveManager;
