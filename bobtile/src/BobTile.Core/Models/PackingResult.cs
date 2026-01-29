namespace BobTile.Core.Models;

public record PackingResult
{
    public bool Success { get; init; }
    public string OutputPath { get; init; } = "";
    public int TileCount { get; init; }
    public int Rows { get; init; }
    public int Columns { get; init; }
    public int AtlasWidth { get; init; }
    public int AtlasHeight { get; init; }
    public TimeSpan Duration { get; init; }
    public string? TsxPath { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }

    public static PackingResult Failed(IReadOnlyList<string> errors) => new()
    {
        Success = false,
        Errors = errors
    };

    public static PackingResult Failed(string error) => Failed(new[] { error });
}
