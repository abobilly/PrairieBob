using System.Text.Json.Serialization;

namespace BobTile.Cli;

/// <summary>
/// JSON-serializable response from atlas packing.
/// Designed for Electron/editor integration.
/// </summary>
public sealed class PackResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("outputPath")]
    public string? OutputPath { get; set; }

    [JsonPropertyName("tsxPath")]
    public string? TsxPath { get; set; }

    [JsonPropertyName("tileCount")]
    public int TileCount { get; set; }

    [JsonPropertyName("rows")]
    public int Rows { get; set; }

    [JsonPropertyName("columns")]
    public int Columns { get; set; }

    [JsonPropertyName("atlasWidth")]
    public int AtlasWidth { get; set; }

    [JsonPropertyName("atlasHeight")]
    public int AtlasHeight { get; set; }

    [JsonPropertyName("durationMs")]
    public double DurationMs { get; set; }

    [JsonPropertyName("errors")]
    public List<string>? Errors { get; set; }

    public static PackResponse FromResult(BobTile.Core.Models.PackingResult result)
    {
        return new PackResponse
        {
            Success = result.Success,
            OutputPath = result.OutputPath,
            TsxPath = result.TsxPath,
            TileCount = result.TileCount,
            Rows = result.Rows,
            Columns = result.Columns,
            AtlasWidth = result.AtlasWidth,
            AtlasHeight = result.AtlasHeight,
            DurationMs = result.Duration.TotalMilliseconds,
            Errors = result.Errors?.ToList()
        };
    }

    public static PackResponse Error(string message) => new()
    {
        Success = false,
        Errors = new List<string> { message }
    };

    public static PackResponse Error(IEnumerable<string> messages) => new()
    {
        Success = false,
        Errors = messages.ToList()
    };
}
