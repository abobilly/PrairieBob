// Package maps handles loading and saving map files.
package maps

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lawchuck/spudtile/cli/pkg/types"
)

// Load reads a map JSON file
func Load(path string) (*types.LevelData, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read map file: %w", err)
	}

	var level types.LevelData
	if err := json.Unmarshal(data, &level); err != nil {
		return nil, fmt.Errorf("failed to parse map file: %w", err)
	}

	return &level, nil
}

// Save writes a map to disk
func Save(path string, level *types.LevelData) error {
	data, err := json.MarshalIndent(level, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal map: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write map file: %w", err)
	}

	return nil
}

// MapInfo contains summary information about a map
type MapInfo struct {
	ID         string
	Path       string
	Width      int
	Height     int
	TileSize   int
	LayerCount int
	EntityCount int
}

// List scans a directory for map files and returns their info
func List(mapsDir string) ([]MapInfo, error) {
	entries, err := os.ReadDir(mapsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read maps directory: %w", err)
	}

	var maps []MapInfo
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		path := filepath.Join(mapsDir, entry.Name())
		level, err := Load(path)
		if err != nil {
			// Skip invalid files
			continue
		}

		entityCount := 0
		for _, layer := range level.Layers {
			if layer.Type == "objectgroup" {
				entityCount += len(layer.Objects)
			}
		}

		maps = append(maps, MapInfo{
			ID:         level.ID,
			Path:       path,
			Width:      level.Width,
			Height:     level.Height,
			TileSize:   level.TileSize,
			LayerCount: len(level.Layers),
			EntityCount: entityCount,
		})
	}

	return maps, nil
}

// FindByID finds a map by its ID in the maps directory
func FindByID(mapsDir, id string) (string, error) {
	// First try direct file match
	directPath := filepath.Join(mapsDir, id+".json")
	if _, err := os.Stat(directPath); err == nil {
		return directPath, nil
	}

	// Scan all maps to find by ID
	maps, err := List(mapsDir)
	if err != nil {
		return "", err
	}

	for _, m := range maps {
		if m.ID == id {
			return m.Path, nil
		}
	}

	return "", fmt.Errorf("map not found: %s", id)
}

// PaintRect modifies tiles in a rectangular region
func PaintRect(level *types.LevelData, layerName string, tileID int, x, y, w, h int) error {
	// Find the layer
	var targetLayer *types.Layer
	for i := range level.Layers {
		if level.Layers[i].Name == layerName {
			targetLayer = &level.Layers[i]
			break
		}
	}

	if targetLayer == nil {
		return fmt.Errorf("layer not found: %s", layerName)
	}

	if targetLayer.Type != "tilelayer" {
		return fmt.Errorf("layer %s is not a tile layer", layerName)
	}

	// Validate bounds
	if x < 0 || y < 0 || x+w > level.Width || y+h > level.Height {
		return fmt.Errorf("rectangle out of bounds: (%d,%d,%d,%d) for map %dx%d", x, y, w, h, level.Width, level.Height)
	}

	// Paint the tiles
	for py := y; py < y+h; py++ {
		for px := x; px < x+w; px++ {
			idx := py*level.Width + px
			if idx < len(targetLayer.Data) {
				targetLayer.Data[idx] = tileID
			}
		}
	}

	return nil
}

// FillLayer fills an entire layer with a single tile
func FillLayer(level *types.LevelData, layerName string, tileID int) error {
	return PaintRect(level, layerName, tileID, 0, 0, level.Width, level.Height)
}
