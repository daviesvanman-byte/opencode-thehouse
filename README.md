# TheHouse

A Big Brother themed 3D game environment with realistic rendering, procedural skin textures, and navigation systems.

## Features

### Realistic Rendering
- Procedural PBR skin texture generation with subsurface scattering
- Normal mapping and roughness/ao textures
- Enhanced lighting pipeline with bloom and ambient occlusion
- High-resolution texture assets (2048px, 1024px)

### Character System
- Rigged GLB avatars with 84-joint skeletons (Mixamo compatible)
- Procedural skeletal animations (idle/walk cycles)
- Customizable skin tones for NPCs
- Stuck recovery and realistic movement

### Big Brother House Environment
- Complete BB UK 2025 house redesign
- BB 2025 saturated color palette
- Eye-shaped dining table, curved kitchen island, underlit beds
- Surveillance cameras and TV mode
- Player spawn in Garden area

### Game Mechanics
- Navigation with physics collision
- Agent thinking and decision systems
- Relationship tracking and intimacy management
- Task-based activity system
- Pause/save functionality

## Technical

### Build System
```bash
npm run build    # Build for production
npm run preview  # Preview with Vite
npm run dev      # Develop with hot reload
```

### Key Technologies
- Three.js for 3D rendering
- cannon-es for physics
- TypeScript for type safety
- Vite for development and builds

### Project Structure
```
src/
  engine/           # Core game engine
  simulation/      # Game logic simulation  
  api/             # External integrations
  utils/           # Utility functions
public/
  models/          # 3D avatar models (8 rigged characters)
  ...             # Other assets
dist/             # Production builds
