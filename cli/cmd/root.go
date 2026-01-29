package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/lawchuck/prairiebob/cli/pkg/maps"
	"github.com/lawchuck/prairiebob/cli/pkg/project"
	"github.com/lawchuck/prairiebob/cli/pkg/types"
	"github.com/spf13/cobra"
)

var projectDir string // Set by --project flag or auto-detected

var rootCmd = &cobra.Command{
	Use:   "pb",
	Short: "PrairieBob CLI - AI-assisted tile map editing",
	Long: `PrairieBob CLI provides command-line access to tile map operations.
Designed for use with GitHub Copilot and automation scripts.

Examples:
  pb list maps
  pb info cottage_main
  pb paint cottage_main --layer Floor --tile 850 --rect 2,2,4,4
  pb export cottage_main --format kimbar`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Skip project detection for help commands
		if cmd.Name() == "help" || cmd.Name() == "version" {
			return nil
		}

		// Auto-detect project if not specified
		if projectDir == "" {
			cwd, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("failed to get working directory: %w", err)
			}
			_, dir, err := project.LoadFromDir(cwd)
			if err != nil {
				return fmt.Errorf("no project found: %w", err)
			}
			projectDir = dir
		}
		return nil
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringVar(&projectDir, "project", "", "Path to project directory (auto-detected if not set)")

	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(infoCmd)
	rootCmd.AddCommand(paintCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(projectInfoCmd)
}

// list command - list maps or tilesets
var listCmd = &cobra.Command{
	Use:   "list [maps|tilesets]",
	Short: "List maps or tilesets in the project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		proj, _, err := project.LoadFromDir(projectDir)
		if err != nil {
			return err
		}

		switch args[0] {
		case "maps":
			mapsDir := project.GetMapsDir(projectDir, proj)
			mapList, err := maps.List(mapsDir)
			if err != nil {
				return err
			}

			if len(mapList) == 0 {
				fmt.Println("No maps found.")
				return nil
			}

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tSIZE\tLAYERS\tENTITIES")
			for _, m := range mapList {
				fmt.Fprintf(w, "%s\t%dx%d\t%d\t%d\n", m.ID, m.Width, m.Height, m.LayerCount, m.EntityCount)
			}
			w.Flush()

		case "tilesets":
			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tFILE\tTILE SIZE\tCOUNT")
			for _, ts := range proj.Tilesets {
				fmt.Fprintf(w, "%s\t%s\t%d\t%d\n", ts.ID, ts.File, ts.TileSize, ts.TileCount)
			}
			w.Flush()

		default:
			return fmt.Errorf("unknown resource type: %s (use 'maps' or 'tilesets')", args[0])
		}

		return nil
	},
}

// info command - show map details
var infoCmd = &cobra.Command{
	Use:   "info [map-id]",
	Short: "Show detailed information about a map",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		proj, _, err := project.LoadFromDir(projectDir)
		if err != nil {
			return err
		}

		mapsDir := project.GetMapsDir(projectDir, proj)
		mapPath, err := maps.FindByID(mapsDir, args[0])
		if err != nil {
			return err
		}

		level, err := maps.Load(mapPath)
		if err != nil {
			return err
		}

		fmt.Printf("Map: %s\n", level.ID)
		fmt.Printf("Size: %dx%d tiles (%dx%d pixels)\n", level.Width, level.Height, level.Width*level.TileSize, level.Height*level.TileSize)
		fmt.Printf("Tile Size: %d\n", level.TileSize)
		fmt.Printf("File: %s\n", mapPath)
		if level.Metadata != nil {
			fmt.Printf("Last Edited: %s\n", level.Metadata.EditedAt)
		}
		fmt.Println()
		fmt.Println("Layers:")
		for i, layer := range level.Layers {
			if layer.Type == "tilelayer" {
				fmt.Printf("  %d. %s (tiles)\n", i+1, layer.Name)
			} else {
				fmt.Printf("  %d. %s (entities: %d)\n", i+1, layer.Name, len(layer.Objects))
			}
		}

		return nil
	},
}

// paint command - modify tiles in a map
var paintCmd = &cobra.Command{
	Use:   "paint [map-id]",
	Short: "Paint tiles on a map",
	Long: `Paint tiles in a rectangular region of a map layer.

Examples:
  pb paint cottage_main --layer Floor --tile 850 --rect 2,2,4,4
  pb paint cottage_main -l Walls -t 0 -r 0,0,12,10`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		layer, _ := cmd.Flags().GetString("layer")
		tileStr, _ := cmd.Flags().GetString("tile")
		rectStr, _ := cmd.Flags().GetString("rect")

		if layer == "" {
			return fmt.Errorf("--layer is required")
		}
		if tileStr == "" {
			return fmt.Errorf("--tile is required")
		}
		if rectStr == "" {
			return fmt.Errorf("--rect is required")
		}

		tileID, err := strconv.Atoi(tileStr)
		if err != nil {
			return fmt.Errorf("invalid tile ID: %s", tileStr)
		}

		// Parse rect as x,y,w,h
		parts := strings.Split(rectStr, ",")
		if len(parts) != 4 {
			return fmt.Errorf("rect must be x,y,w,h (got: %s)", rectStr)
		}
		x, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
		y, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
		w, _ := strconv.Atoi(strings.TrimSpace(parts[2]))
		h, _ := strconv.Atoi(strings.TrimSpace(parts[3]))

		proj, _, err := project.LoadFromDir(projectDir)
		if err != nil {
			return err
		}

		mapsDir := project.GetMapsDir(projectDir, proj)
		mapPath, err := maps.FindByID(mapsDir, args[0])
		if err != nil {
			return err
		}

		level, err := maps.Load(mapPath)
		if err != nil {
			return err
		}

		if err := maps.PaintRect(level, layer, tileID, x, y, w, h); err != nil {
			return err
		}

		// Update metadata
		if level.Metadata == nil {
			level.Metadata = &types.Metadata{}
		}
		level.Metadata.EditedAt = time.Now().UTC().Format(time.RFC3339)
		level.Metadata.ExportedFrom = "prairiebob-cli"

		if err := maps.Save(mapPath, level); err != nil {
			return err
		}

		fmt.Printf("Painted tile %d on layer '%s' at rect(%d,%d,%d,%d) in %s\n", tileID, layer, x, y, w, h, args[0])
		return nil
	},
}

// export command - export map to game format
var exportCmd = &cobra.Command{
	Use:   "export [map-id]",
	Short: "Export a map to specified format",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		format, _ := cmd.Flags().GetString("format")
		output, _ := cmd.Flags().GetString("output")

		proj, _, err := project.LoadFromDir(projectDir)
		if err != nil {
			return err
		}

		mapsDir := project.GetMapsDir(projectDir, proj)
		mapPath, err := maps.FindByID(mapsDir, args[0])
		if err != nil {
			return err
		}

		level, err := maps.Load(mapPath)
		if err != nil {
			return err
		}

		// Determine output path
		if output == "" {
			exportsDir := project.GetExportsDir(projectDir, proj)
			output = fmt.Sprintf("%s/%s/%s.json", exportsDir, format, level.ID)
		}

		// For now, just copy the JSON (future: transform to format-specific schema)
		if err := os.MkdirAll(strings.TrimSuffix(output, "/"+level.ID+".json"), 0755); err != nil {
			return err
		}

		if err := maps.Save(output, level); err != nil {
			return err
		}

		fmt.Printf("Exported %s to %s (format: %s)\n", level.ID, output, format)
		return nil
	},
}

// project info command
var projectInfoCmd = &cobra.Command{
	Use:   "project",
	Short: "Show project information",
	RunE: func(cmd *cobra.Command, args []string) error {
		proj, dir, err := project.LoadFromDir(projectDir)
		if err != nil {
			return err
		}

		fmt.Printf("Project: %s\n", proj.Name)
		fmt.Printf("Version: %s\n", proj.Version)
		fmt.Printf("Location: %s\n", dir)
		fmt.Printf("Tile Size: %d\n", proj.TileSize)
		fmt.Printf("Tilesets: %d\n", len(proj.Tilesets))
		if proj.License != nil {
			fmt.Printf("License: %s\n", proj.License.Type)
		}

		return nil
	},
}

func init() {
	paintCmd.Flags().StringP("layer", "l", "", "Target layer name (required)")
	paintCmd.Flags().StringP("tile", "t", "", "Tile ID (required)")
	paintCmd.Flags().StringP("rect", "r", "", "Rectangle bounds x,y,w,h (required)")

	exportCmd.Flags().StringP("format", "f", "kimbar", "Export format (kimbar, tiled)")
	exportCmd.Flags().StringP("output", "o", "", "Output file path (default: exports/<format>/<map>.json)")
}
