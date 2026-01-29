namespace BobTile.Core.Models;

public record TilePackerSettings
{
    public InputMode Mode { get; init; } = InputMode.Folder;
    public string? FolderPath { get; init; }
    public IReadOnlyList<string>? SelectedFiles { get; init; }
    public IReadOnlyList<TilesetInput>? SelectedTilesets { get; init; }

    public int TileSize { get; init; } = 32;
    public int Columns { get; init; } = 16; // 0 = auto
    public int Padding { get; init; } = 0;
    public bool ExtrudeEdges { get; init; } = false;
    public bool ResizeToTileSize { get; init; } = false;

    // For Atlas Combine mode: padding in source tilesets
    public int SourcePadding { get; init; } = 0;
    
    // For Atlas Combine mode: start each tileset on a new row
    public bool StartTilesetsOnNewRow { get; init; } = false;

    public string OutputFolder { get; init; } = "";
    public string OutputFilename { get; init; } = "tileset";
    public bool GenerateTsx { get; init; } = false;
}
