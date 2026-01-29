// Package types defines the core data structures for PrairieBob projects.
// These structs match the TypeScript interfaces in src/lib/types.ts.
package types

// Project represents a prairiebob project.json manifest
type Project struct {
	Schema          string            `json:"$schema,omitempty"`
	Name            string            `json:"name"`
	Version         string            `json:"version"`
	TileSize        int               `json:"tileSize"`
	DefaultMapSize  MapSize           `json:"defaultMapSize,omitempty"`
	Paths           ProjectPaths      `json:"paths"`
	Tilesets        []TilesetRef      `json:"tilesets"`
	LayerTemplates  map[string][]string `json:"layerTemplates,omitempty"`
	License         *License          `json:"license,omitempty"`
	LinkedProject   *LinkedProject    `json:"linkedProject,omitempty"`
}

type MapSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type ProjectPaths struct {
	Maps         string `json:"maps"`
	Tilesets     string `json:"tilesets"`
	Interactions string `json:"interactions"`
	Entities     string `json:"entities"`
	Exports      string `json:"exports"`
}

type TilesetRef struct {
	ID        string `json:"id"`
	File      string `json:"file"`
	TileSize  int    `json:"tileSize"`
	Columns   int    `json:"columns,omitempty"`
	TileCount int    `json:"tileCount,omitempty"`
}

type License struct {
	Type string `json:"type"`
	Note string `json:"note,omitempty"`
}

type LinkedProject struct {
	Name       string `json:"name"`
	RootPath   string `json:"rootPath"`
	ExportPath string `json:"exportPath,omitempty"`
}

// LevelData represents a map file (maps/*.json)
type LevelData struct {
	ID       string    `json:"id"`
	Width    int       `json:"width"`
	Height   int       `json:"height"`
	TileSize int       `json:"tileSize"`
	Layers   []Layer   `json:"layers"`
	Metadata *Metadata `json:"metadata,omitempty"`
}

type Layer struct {
	Name    string       `json:"name"`
	Type    string       `json:"type"` // "tilelayer" or "objectgroup"
	Visible bool         `json:"visible"`
	Locked  bool         `json:"locked"`
	Opacity float64      `json:"opacity,omitempty"`
	Data    []int        `json:"data,omitempty"`    // For tilelayer
	Objects []EntityData `json:"objects,omitempty"` // For objectgroup
}

type EntityData struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"` // spawn_point, door, npc, trigger, prop
	X          float64                `json:"x"`
	Y          float64                `json:"y"`
	Width      float64                `json:"width"`
	Height     float64                `json:"height"`
	Properties map[string]interface{} `json:"properties,omitempty"`
}

type Metadata struct {
	EditedAt     string `json:"editedAt"`
	ExportedFrom string `json:"exportedFrom"`
	Version      string `json:"version"`
}

// Tileset represents a tileset definition (tilesets/*.tileset.json)
type Tileset struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Image       string            `json:"image"`
	TileSize    int               `json:"tileSize"`
	Columns     int               `json:"columns"`
	TileCount   int               `json:"tileCount"`
	ImageWidth  int               `json:"imageWidth,omitempty"`
	ImageHeight int               `json:"imageHeight,omitempty"`
	License     string            `json:"license,omitempty"`
	Source      string            `json:"source,omitempty"`
	Tiles       map[string]TileDef `json:"tiles,omitempty"`
}

type TileDef struct {
	Name      string `json:"name,omitempty"`
	Collision bool   `json:"collision,omitempty"`
}

// Interaction represents a state-based interaction (interactions/*.json)
type Interaction struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type"` // door, chest, switch
	TileSize    int                       `json:"tileSize,omitempty"`
	Size        *InteractionSize          `json:"size,omitempty"`
	States      map[string]InteractionState `json:"states"`
	Transitions map[string]Transition     `json:"transitions,omitempty"`
	DefaultState string                   `json:"defaultState"`
}

type InteractionSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type InteractionState struct {
	Tiles     [][]int `json:"tiles"`
	Collision bool    `json:"collision"`
}

type Transition struct {
	Duration int `json:"duration"` // milliseconds
}
