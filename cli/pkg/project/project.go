// Package project handles loading and saving SpudTile project files.
package project

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lawchuck/spudtile/cli/pkg/types"
)

const ProjectFileName = "project.json"

// Load reads a project.json file from the given path
func Load(path string) (*types.Project, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read project file: %w", err)
	}

	var proj types.Project
	if err := json.Unmarshal(data, &proj); err != nil {
		return nil, fmt.Errorf("failed to parse project file: %w", err)
	}

	return &proj, nil
}

// Save writes a project to disk
func Save(path string, proj *types.Project) error {
	data, err := json.MarshalIndent(proj, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal project: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write project file: %w", err)
	}

	return nil
}

// FindProject walks up the directory tree looking for project.json
func FindProject(startDir string) (string, error) {
	dir := startDir
	for {
		candidate := filepath.Join(dir, ProjectFileName)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			return "", fmt.Errorf("no %s found in %s or parent directories", ProjectFileName, startDir)
		}
		dir = parent
	}
}

// LoadFromDir finds and loads a project starting from the given directory
func LoadFromDir(startDir string) (*types.Project, string, error) {
	projectPath, err := FindProject(startDir)
	if err != nil {
		return nil, "", err
	}

	proj, err := Load(projectPath)
	if err != nil {
		return nil, "", err
	}

	return proj, filepath.Dir(projectPath), nil
}

// GetMapsDir returns the absolute path to the maps directory
func GetMapsDir(projectDir string, proj *types.Project) string {
	if filepath.IsAbs(proj.Paths.Maps) {
		return proj.Paths.Maps
	}
	return filepath.Join(projectDir, proj.Paths.Maps)
}

// GetTilesetsDir returns the absolute path to the tilesets directory
func GetTilesetsDir(projectDir string, proj *types.Project) string {
	if filepath.IsAbs(proj.Paths.Tilesets) {
		return proj.Paths.Tilesets
	}
	return filepath.Join(projectDir, proj.Paths.Tilesets)
}

// GetInteractionsDir returns the absolute path to the interactions directory
func GetInteractionsDir(projectDir string, proj *types.Project) string {
	if filepath.IsAbs(proj.Paths.Interactions) {
		return proj.Paths.Interactions
	}
	return filepath.Join(projectDir, proj.Paths.Interactions)
}

// GetExportsDir returns the absolute path to the exports directory
func GetExportsDir(projectDir string, proj *types.Project) string {
	if filepath.IsAbs(proj.Paths.Exports) {
		return proj.Paths.Exports
	}
	return filepath.Join(projectDir, proj.Paths.Exports)
}
