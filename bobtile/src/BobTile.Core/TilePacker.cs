using System.Diagnostics;
using BobTile.Core.Export;
using BobTile.Core.ImageProcessing;
using BobTile.Core.Models;
using SkiaSharp;

namespace BobTile.Core;

public class TilePacker
{
    public PackingResult Pack(TilePackerSettings settings, IProgress<int>? progress = null, Action<SKBitmap>? previewCallback = null)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Handle Atlas Combine mode separately
            if (settings.Mode == InputMode.AtlasCombine)
            {
                return PackAtlasCombine(settings, progress, stopwatch, previewCallback);
            }

            // Collect image files
            var filePaths = CollectImageFiles(settings);
            if (filePaths.Count == 0)
            {
                return PackingResult.Failed("No images found.");
            }

            // Load images (expand tiles that are multiples of tile size)
            var tiles = new List<TileImage>();
            try
            {
                foreach (var path in filePaths)
                {
                    tiles.AddRange(LoadTilesForPath(path, settings));
                }

                // Validate sizes if resize is disabled
                if (!settings.ResizeToTileSize)
                {
                    var mismatches = ImageValidator.ValidateTileSizes(tiles, settings.TileSize);
                    if (mismatches.Count > 0)
                    {
                        return PackingResult.Failed(mismatches);
                    }
                }

                return CreateAtlasAndExport(tiles, settings, false, progress, stopwatch, previewCallback);
            }
            finally
            {
                foreach (var tile in tiles)
                {
                    tile.Dispose();
                }
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return PackingResult.Failed($"Error: {ex.Message}");
        }
    }

    private PackingResult PackAtlasCombine(TilePackerSettings settings, IProgress<int>? progress, Stopwatch stopwatch, Action<SKBitmap>? previewCallback)
    {
        var tilesetInputs = settings.SelectedTilesets?.ToList()
            ?? settings.SelectedFiles?.Select(path => new TilesetInput(path, settings.TileSize)).ToList()
            ?? new List<TilesetInput>();

        if (tilesetInputs.Count == 0)
        {
            return PackingResult.Failed("No tileset files selected.");
        }

        bool resizeNeeded = tilesetInputs.Any(t => t.InputTileSize != settings.TileSize);

        // Validate all tilesets have compatible dimensions
        var errors = new List<string>();
        foreach (var tileset in tilesetInputs)
        {
            var validation = TilesetExtractor.ValidateTileset(tileset.Path, tileset.InputTileSize, settings.SourcePadding);
            if (!validation.IsValid)
            {
                errors.Add(validation.Error ?? $"Invalid tileset: {tileset.Path}");
            }
        }

        if (errors.Count > 0)
        {
            return PackingResult.Failed(errors);
        }

        // Extract tiles from all tilesets - keep them grouped if StartTilesetsOnNewRow is enabled
        var tilesetGroups = new List<List<SKBitmap>>();
        var allTiles = new List<SKBitmap>();
        try
        {
            int totalFiles = tilesetInputs.Count;
            int processedFiles = 0;

            foreach (var tileset in tilesetInputs)
            {
                var extractedTiles = TilesetExtractor.ExtractTiles(
                    tileset.Path,
                    tileset.InputTileSize,
                    settings.SourcePadding);
                
                if (settings.StartTilesetsOnNewRow)
                {
                    tilesetGroups.Add(extractedTiles);
                }
                allTiles.AddRange(extractedTiles);

                processedFiles++;
                progress?.Report((int)((processedFiles / (float)totalFiles) * 50)); // 0-50% for extraction
            }

            if (allTiles.Count == 0)
            {
                return PackingResult.Failed("No tiles extracted from tilesets (all tiles may be empty/transparent).");
            }

            if (settings.StartTilesetsOnNewRow)
            {
                // Create atlas with grouped tiles (each group starts on new row)
                return CreateAtlasWithGroupsAndExport(tilesetGroups, settings, resizeNeeded,
                    new Progress<int>(p => progress?.Report(50 + p / 2)),
                    stopwatch,
                    previewCallback);
            }
            else
            {
                // Convert to TileImage list for standard atlas generation
                var tiles = allTiles.Select((bmp, idx) => new TileImage(
                    $"atlas_tile_{idx}.png",
                    bmp
                )).ToList();

                try
                {
                    return CreateAtlasAndExport(tiles, settings, resizeNeeded,
                        new Progress<int>(p => progress?.Report(50 + p / 2)), // 50-100% for atlas creation
                        stopwatch,
                        previewCallback);
                }
                finally
                {
                    foreach (var tile in tiles)
                    {
                        tile.Dispose();
                    }
                }
            }
        }
        catch
        {
            // Clean up any extracted tiles on error
            foreach (var tile in allTiles)
            {
                tile.Dispose();
            }
            throw;
        }
    }

    private PackingResult CreateAtlasAndExport(
        List<TileImage> tiles,
        TilePackerSettings settings,
        bool resizeToTileSize,
        IProgress<int>? progress,
        Stopwatch stopwatch,
        Action<SKBitmap>? previewCallback)
    {
        // Calculate dimensions
        int columns = settings.Columns > 0 ? settings.Columns : (int)Math.Ceiling(Math.Sqrt(tiles.Count));
        int padding = settings.Padding;

        // Auto-set padding to 1 if extrude is enabled and padding is 0
        if (settings.ExtrudeEdges && padding == 0)
        {
            padding = 1;
        }

        // Create atlas
        using var atlas = AtlasGenerator.CreateAtlas(
            tiles,
            settings.TileSize,
            columns,
            padding,
            settings.ExtrudeEdges,
            settings.ResizeToTileSize || resizeToTileSize,
            progress);

        if (previewCallback != null)
        {
            using var preview = new SKBitmap(atlas.Width, atlas.Height, atlas.ColorType, atlas.AlphaType);
            atlas.CopyTo(preview);
            previewCallback(preview);
        }

        // Ensure output folder exists
        if (!Directory.Exists(settings.OutputFolder))
        {
            Directory.CreateDirectory(settings.OutputFolder);
        }

        // Export PNG
        string pngPath = Path.Combine(settings.OutputFolder, settings.OutputFilename + ".png");
        PngExporter.Export(atlas, pngPath);

        // Export TSX if enabled
        string? tsxPath = null;
        if (settings.GenerateTsx)
        {
            tsxPath = Path.Combine(settings.OutputFolder, settings.OutputFilename + ".tsx");
            TsxExporter.Export(
                tsxPath,
                settings.OutputFilename + ".png",
                settings.TileSize,
                settings.TileSize,
                tiles.Count,
                columns,
                atlas.Width,
                atlas.Height);
        }

        stopwatch.Stop();

        int rows = (int)Math.Ceiling((double)tiles.Count / columns);

        return new PackingResult
        {
            Success = true,
            OutputPath = pngPath,
            TileCount = tiles.Count,
            Rows = rows,
            Columns = columns,
            AtlasWidth = atlas.Width,
            AtlasHeight = atlas.Height,
            Duration = stopwatch.Elapsed,
            TsxPath = tsxPath
        };
    }

    private PackingResult CreateAtlasWithGroupsAndExport(
        List<List<SKBitmap>> tilesetGroups,
        TilePackerSettings settings,
        bool resizeToTileSize,
        IProgress<int>? progress,
        Stopwatch stopwatch,
        Action<SKBitmap>? previewCallback)
    {
        // Convert each group to TileImage list
        var tileGroups = tilesetGroups
            .Select(group => group
                .Select((bmp, idx) => new TileImage($"tile_{idx}.png", bmp))
                .ToList() as IReadOnlyList<TileImage>)
            .ToList() as IReadOnlyList<IReadOnlyList<TileImage>>;

        try
        {
            int totalTiles = tilesetGroups.Sum(g => g.Count);
            int columns = settings.Columns > 0 ? settings.Columns : (int)Math.Ceiling(Math.Sqrt(totalTiles));
            int padding = settings.Padding;

            // Auto-set padding to 1 if extrude is enabled and padding is 0
            if (settings.ExtrudeEdges && padding == 0)
            {
                padding = 1;
            }

            // Create atlas with grouped tiles
            using var atlas = AtlasGenerator.CreateAtlasWithGroups(
                tileGroups,
                settings.TileSize,
                columns,
                padding,
                settings.ExtrudeEdges,
                settings.ResizeToTileSize || resizeToTileSize,
                progress);

            if (previewCallback != null)
            {
                using var preview = new SKBitmap(atlas.Width, atlas.Height, atlas.ColorType, atlas.AlphaType);
                atlas.CopyTo(preview);
                previewCallback(preview);
            }

            // Ensure output folder exists
            if (!Directory.Exists(settings.OutputFolder))
            {
                Directory.CreateDirectory(settings.OutputFolder);
            }

            // Export PNG
            string pngPath = Path.Combine(settings.OutputFolder, settings.OutputFilename + ".png");
            PngExporter.Export(atlas, pngPath);

            // Export TSX if enabled
            string? tsxPath = null;
            if (settings.GenerateTsx)
            {
                tsxPath = Path.Combine(settings.OutputFolder, settings.OutputFilename + ".tsx");
                var tileCounts = tilesetGroups.Select(g => g.Count).ToList();
                int rows = AtlasGenerator.CalculateRowsWithGroups(tileCounts, columns);
                TsxExporter.Export(
                    tsxPath,
                    settings.OutputFilename + ".png",
                    settings.TileSize,
                    settings.TileSize,
                    totalTiles,
                    columns,
                    atlas.Width,
                    atlas.Height);
            }

            stopwatch.Stop();

            var finalTileCounts = tilesetGroups.Select(g => g.Count).ToList();
            int finalRows = AtlasGenerator.CalculateRowsWithGroups(finalTileCounts, columns);

            return new PackingResult
            {
                Success = true,
                OutputPath = pngPath,
                TileCount = totalTiles,
                Rows = finalRows,
                Columns = columns,
                AtlasWidth = atlas.Width,
                AtlasHeight = atlas.Height,
                Duration = stopwatch.Elapsed,
                TsxPath = tsxPath
            };
        }
        finally
        {
            // Dispose all TileImages
            foreach (var group in tileGroups)
            {
                foreach (var tile in group)
                {
                    tile.Dispose();
                }
            }
        }
    }

    private static IEnumerable<TileImage> LoadTilesForPath(string path, TilePackerSettings settings)
    {
        var tile = ImageLoader.LoadImage(path);

        // If the tile is already the correct size, keep as-is.
        if (tile.Width == settings.TileSize && tile.Height == settings.TileSize)
        {
            return new[] { tile };
        }

        // If the tile dimensions are multiples of the tile size, split into tiles.
        if (tile.Width % settings.TileSize == 0 && tile.Height % settings.TileSize == 0)
        {
            var splitTiles = SplitTileImage(tile, settings.TileSize).ToList();
            tile.Dispose();
            return splitTiles;
        }

        // If resize is enabled, resize to tile size.
        if (settings.ResizeToTileSize)
        {
            var resized = ImageResizer.ResizeNearestNeighbor(tile.Bitmap, settings.TileSize, settings.TileSize);
            tile.Dispose();
            return new[] { new TileImage(path, resized) };
        }

        // Leave as-is; validation will handle mismatched sizes.
        return new[] { tile };
    }

    private static IEnumerable<TileImage> SplitTileImage(TileImage source, int tileSize)
    {
        int cols = source.Width / tileSize;
        int rows = source.Height / tileSize;

        for (int row = 0; row < rows; row++)
        {
            for (int col = 0; col < cols; col++)
            {
                var tileBitmap = new SKBitmap(tileSize, tileSize, SKColorType.Rgba8888, SKAlphaType.Premul);
                using var canvas = new SKCanvas(tileBitmap);

                var srcRect = new SKRect(
                    col * tileSize,
                    row * tileSize,
                    (col + 1) * tileSize,
                    (row + 1) * tileSize);
                var destRect = new SKRect(0, 0, tileSize, tileSize);

                canvas.DrawBitmap(source.Bitmap, srcRect, destRect);

                var filePath = $"{source.FilePath}#r{row}_c{col}";
                yield return new TileImage(filePath, tileBitmap);
            }
        }
    }

    private static List<string> CollectImageFiles(TilePackerSettings settings)
    {
        return settings.Mode switch
        {
            InputMode.Folder when !string.IsNullOrEmpty(settings.FolderPath) =>
                ImageLoader.GetImagesFromFolder(settings.FolderPath),

            InputMode.FileSelect when settings.SelectedFiles?.Count > 0 =>
                settings.SelectedFiles.ToList(),

            _ => new List<string>()
        };
    }
}
