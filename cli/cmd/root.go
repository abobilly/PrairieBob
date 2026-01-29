package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "prairiebob",
	Short: "PrairieBob CLI - AI-assisted tile map editing",
	Long: `PrairieBob CLI provides command-line access to tile map operations.
Designed for use with GitHub Copilot and automation scripts.

Examples:
  prairiebob list maps
  prairiebob paint room_01 --layer Floor --tile grass --rect 0,0,10,10
  prairiebob export room_01 --format kimbar`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(paintCmd)
	rootCmd.AddCommand(exportCmd)
}

// Placeholder commands - will be expanded
var listCmd = &cobra.Command{
	Use:   "list [resource]",
	Short: "List maps, tilesets, or entities",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Listing %s...\n", args[0])
	},
}

var paintCmd = &cobra.Command{
	Use:   "paint [map-id]",
	Short: "Paint tiles on a map",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		layer, _ := cmd.Flags().GetString("layer")
		tile, _ := cmd.Flags().GetString("tile")
		rect, _ := cmd.Flags().GetString("rect")
		fmt.Printf("Painting on %s: layer=%s, tile=%s, rect=%s\n", args[0], layer, tile, rect)
	},
}

var exportCmd = &cobra.Command{
	Use:   "export [map-id]",
	Short: "Export a map to specified format",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		format, _ := cmd.Flags().GetString("format")
		fmt.Printf("Exporting %s as %s\n", args[0], format)
	},
}

func init() {
	paintCmd.Flags().StringP("layer", "l", "", "Target layer name")
	paintCmd.Flags().StringP("tile", "t", "", "Tile ID or name")
	paintCmd.Flags().StringP("rect", "r", "", "Rectangle bounds (x,y,w,h)")

	exportCmd.Flags().StringP("format", "f", "kimbar", "Export format (kimbar, tiled, ldtk)")
}
