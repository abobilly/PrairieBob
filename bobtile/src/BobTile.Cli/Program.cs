using System.Text.Json;
using BobTile.Cli;
using BobTile.Core;
using BobTile.Core.Models;

// JSON options for pretty output and case-insensitive input
var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    WriteIndented = true
};

PackRequest? request = null;
string? inputSource = null;

try
{
    // Parse arguments
    // Usage:
    //   bobtile-cli --json request.json
    //   bobtile-cli --stdin              (read JSON from stdin)
    //   bobtile-cli < request.json       (pipe JSON to stdin)
    //   echo '{"files":["a.png"],...}' | bobtile-cli --stdin

    if (args.Length == 0 || args.Contains("--stdin") || args.Contains("-"))
    {
        // Read from stdin
        inputSource = "stdin";
        using var reader = new StreamReader(Console.OpenStandardInput());
        var json = await reader.ReadToEndAsync();
        if (string.IsNullOrWhiteSpace(json))
        {
            WriteError("No input provided. Use --json <file> or pipe JSON to stdin.");
            return 1;
        }
        request = JsonSerializer.Deserialize<PackRequest>(json, jsonOptions);
    }
    else if (args.Length >= 2 && args[0] == "--json")
    {
        // Read from file
        inputSource = args[1];
        if (!File.Exists(inputSource))
        {
            WriteError($"Request file not found: {inputSource}");
            return 1;
        }
        var json = await File.ReadAllTextAsync(inputSource);
        request = JsonSerializer.Deserialize<PackRequest>(json, jsonOptions);
    }
    else if (args.Contains("--help") || args.Contains("-h"))
    {
        PrintHelp();
        return 0;
    }
    else
    {
        WriteError($"Unknown arguments: {string.Join(" ", args)}. Use --help for usage.");
        return 1;
    }

    if (request == null)
    {
        WriteError("Failed to parse request JSON.");
        return 1;
    }

    // Convert DTO to core settings
    var settings = ConvertToSettings(request);

    // Run packer
    var packer = new TilePacker();
    var result = packer.Pack(settings);

    // Output response
    var response = PackResponse.FromResult(result);
    Console.WriteLine(JsonSerializer.Serialize(response, jsonOptions));

    return result.Success ? 0 : 1;
}
catch (JsonException ex)
{
    WriteError($"Invalid JSON: {ex.Message}");
    return 1;
}
catch (Exception ex)
{
    WriteError($"Error: {ex.Message}");
    return 1;
}

void WriteError(string message)
{
    var response = PackResponse.Error(message);
    Console.WriteLine(JsonSerializer.Serialize(response, jsonOptions));
}

void PrintHelp()
{
    Console.WriteLine("""
        bobtile-cli - BobTile Atlas Packer CLI
        
        Usage:
          bobtile-cli --json <request.json>   Read request from JSON file
          bobtile-cli --stdin                 Read request JSON from stdin
          bobtile-cli < request.json          Pipe request JSON to stdin
          bobtile-cli --help                  Show this help
        
        Request JSON format:
          {
            "mode": "tiles" | "combine",
            "inputMode": "folder" | "files",
            "folderPath": "path/to/tiles/",
            "files": ["tile1.png", "tile2.png"],
            "tilesets": [{ "path": "tileset.png", "tileSize": 32 }],
            "tileSize": 32,
            "columns": 16,
            "padding": 0,
            "extrudeEdges": false,
            "resizeToTileSize": false,
            "sourcePadding": 0,
            "startTilesetsOnNewRow": false,
            "outputFolder": "output/",
            "outputFilename": "atlas",
            "generateTsx": true
          }
        
        Response JSON:
          {
            "success": true,
            "outputPath": "output/atlas.png",
            "tsxPath": "output/atlas.tsx",
            "tileCount": 64,
            "rows": 4,
            "columns": 16,
            "atlasWidth": 512,
            "atlasHeight": 128,
            "durationMs": 123.45,
            "errors": null
          }
        
        Examples:
          # Pack tiles from folder
          bobtile-cli --json pack-tiles.json
          
          # Combine tilesets via stdin (Electron integration)
          echo '{"mode":"combine","files":["a.png","b.png"],"outputFolder":"out","outputFilename":"merged"}' | bobtile-cli --stdin
        """);
}

TilePackerSettings ConvertToSettings(PackRequest req)
{
    var mode = req.Mode?.ToLowerInvariant() switch
    {
        "combine" => InputMode.AtlasCombine,
        "tiles" => req.InputMode?.ToLowerInvariant() == "folder" ? InputMode.Folder : InputMode.FileSelect,
        _ => InputMode.FileSelect
    };

    IReadOnlyList<TilesetInput>? tilesets = null;
    if (mode == InputMode.AtlasCombine)
    {
        if (req.Tilesets != null && req.Tilesets.Count > 0)
        {
            tilesets = req.Tilesets.Select(t => new TilesetInput(t.Path, t.TileSize)).ToList();
        }
        else if (req.Files != null && req.Files.Count > 0)
        {
            tilesets = req.Files.Select(f => new TilesetInput(f, req.TileSize)).ToList();
        }
    }

    return new TilePackerSettings
    {
        Mode = mode,
        FolderPath = req.FolderPath,
        SelectedFiles = req.Files,
        SelectedTilesets = tilesets,
        TileSize = req.TileSize > 0 ? req.TileSize : 32,
        Columns = req.Columns,
        Padding = req.Padding,
        ExtrudeEdges = req.ExtrudeEdges,
        ResizeToTileSize = req.ResizeToTileSize,
        SourcePadding = req.SourcePadding,
        StartTilesetsOnNewRow = req.StartTilesetsOnNewRow,
        OutputFolder = req.OutputFolder ?? "",
        OutputFilename = req.OutputFilename ?? "tileset",
        GenerateTsx = req.GenerateTsx
    };
}
