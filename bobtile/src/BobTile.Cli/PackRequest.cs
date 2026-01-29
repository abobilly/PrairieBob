using System.Text.Json.Serialization;

namespace BobTile.Cli;

/// <summary>
/// JSON-serializable request for atlas packing.
/// Designed for Electron/editor integration.
/// </summary>
public sealed class PackRequest
{
    /// <summary>
    /// "tiles" = individual tile images, "combine" = merge existing tilesets
    /// </summary>
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "tiles";

    /// <summary>
    /// Input mode for tiles: "folder" or "files"
    /// </summary>
    [JsonPropertyName("inputMode")]
    public string InputMode { get; set; } = "files";

    /// <summary>
    /// Folder path (when inputMode = "folder")
    /// </summary>
    [JsonPropertyName("folderPath")]
    public string? FolderPath { get; set; }

    /// <summary>
    /// List of input image paths (when inputMode = "files" or mode = "combine")
    /// </summary>
    [JsonPropertyName("files")]
    public List<string>? Files { get; set; }

    /// <summary>
    /// For combine mode: per-tileset settings [{ path, tileSize }]
    /// </summary>
    [JsonPropertyName("tilesets")]
    public List<TilesetInputDto>? Tilesets { get; set; }

    /// <summary>
    /// Output tile size in pixels (default 32)
    /// </summary>
    [JsonPropertyName("tileSize")]
    public int TileSize { get; set; } = 32;

    /// <summary>
    /// Number of columns in output atlas (0 = auto)
    /// </summary>
    [JsonPropertyName("columns")]
    public int Columns { get; set; } = 0;

    /// <summary>
    /// Padding around each tile in output (default 0)
    /// </summary>
    [JsonPropertyName("padding")]
    public int Padding { get; set; } = 0;

    /// <summary>
    /// Extrude edge pixels by 1px to prevent bleeding
    /// </summary>
    [JsonPropertyName("extrudeEdges")]
    public bool ExtrudeEdges { get; set; } = false;

    /// <summary>
    /// Resize input images to tile size (nearest neighbor)
    /// </summary>
    [JsonPropertyName("resizeToTileSize")]
    public bool ResizeToTileSize { get; set; } = false;

    /// <summary>
    /// For combine mode: padding in source tilesets
    /// </summary>
    [JsonPropertyName("sourcePadding")]
    public int SourcePadding { get; set; } = 0;

    /// <summary>
    /// For combine mode: start each tileset on a new row
    /// </summary>
    [JsonPropertyName("startTilesetsOnNewRow")]
    public bool StartTilesetsOnNewRow { get; set; } = false;

    /// <summary>
    /// Output folder path
    /// </summary>
    [JsonPropertyName("outputFolder")]
    public string OutputFolder { get; set; } = "";

    /// <summary>
    /// Output filename (without extension)
    /// </summary>
    [JsonPropertyName("outputFilename")]
    public string OutputFilename { get; set; } = "tileset";

    /// <summary>
    /// Generate Tiled .tsx file alongside PNG
    /// </summary>
    [JsonPropertyName("generateTsx")]
    public bool GenerateTsx { get; set; } = false;
}

public sealed class TilesetInputDto
{
    [JsonPropertyName("path")]
    public string Path { get; set; } = "";

    [JsonPropertyName("tileSize")]
    public int TileSize { get; set; } = 32;
}
