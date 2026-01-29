using BobTile.Core.Models;
using SkiaSharp;

namespace BobTile.Core.ImageProcessing;

public static class TilesetExtractor
{
    /// <summary>
    /// Extracts individual tiles from a tileset image.
    /// </summary>
    /// <param name="tilesetPath">Path to the tileset image</param>
    /// <param name="tileSize">Size of each tile (width and height)</param>
    /// <param name="padding">Padding between tiles in the source tileset (default 0)</param>
    /// <returns>List of extracted tile bitmaps</returns>
    public static List<SKBitmap> ExtractTiles(string tilesetPath, int tileSize, int padding = 0)
    {
        using var tileset = SKBitmap.Decode(tilesetPath);
        if (tileset == null)
        {
            throw new InvalidOperationException($"Failed to load tileset: {tilesetPath}");
        }

        return ExtractTiles(tileset, tileSize, padding);
    }

    /// <summary>
    /// Extracts individual tiles from a tileset bitmap.
    /// </summary>
    public static List<SKBitmap> ExtractTiles(SKBitmap tileset, int tileSize, int padding = 0)
    {
        var tiles = new List<SKBitmap>();
        int cellSize = tileSize + padding;

        int cols = tileset.Width / cellSize;
        int rows = tileset.Height / cellSize;

        // Handle case where tileset doesn't have padding on the right/bottom edge
        if (tileset.Width % cellSize >= tileSize) cols++;
        if (tileset.Height % cellSize >= tileSize) rows++;

        // Recalculate if no padding - simple division
        if (padding == 0)
        {
            cols = tileset.Width / tileSize;
            rows = tileset.Height / tileSize;
        }

        for (int row = 0; row < rows; row++)
        {
            for (int col = 0; col < cols; col++)
            {
                int x = col * cellSize;
                int y = row * cellSize;

                // Make sure we don't go out of bounds
                if (x + tileSize > tileset.Width || y + tileSize > tileset.Height)
                    continue;

                var tile = new SKBitmap(tileSize, tileSize, SKColorType.Rgba8888, SKAlphaType.Premul);
                using var canvas = new SKCanvas(tile);

                var srcRect = new SKRect(x, y, x + tileSize, y + tileSize);
                var destRect = new SKRect(0, 0, tileSize, tileSize);

                canvas.DrawBitmap(tileset, srcRect, destRect);

                // Only add non-empty tiles (check if tile has any non-transparent pixels)
                if (!IsEmptyTile(tile))
                {
                    tiles.Add(tile);
                }
                else
                {
                    tile.Dispose();
                }
            }
        }

        return tiles;
    }

    /// <summary>
    /// Checks if a tile is completely empty (all transparent pixels).
    /// </summary>
    private static bool IsEmptyTile(SKBitmap tile)
    {
        for (int y = 0; y < tile.Height; y++)
        {
            for (int x = 0; x < tile.Width; x++)
            {
                var pixel = tile.GetPixel(x, y);
                if (pixel.Alpha > 0)
                {
                    return false;
                }
            }
        }
        return true;
    }

    /// <summary>
    /// Validates that a tileset image dimensions are compatible with the tile size.
    /// </summary>
    public static (bool IsValid, int Columns, int Rows, string? Error) ValidateTileset(
        string tilesetPath, int tileSize, int padding = 0)
    {
        using var tileset = SKBitmap.Decode(tilesetPath);
        if (tileset == null)
        {
            return (false, 0, 0, $"Failed to load image: {tilesetPath}");
        }

        return ValidateTileset(tileset, tileSize, padding, tilesetPath);
    }

    public static (bool IsValid, int Columns, int Rows, string? Error) ValidateTileset(
        SKBitmap tileset, int tileSize, int padding, string? sourcePath = null)
    {
        int cellSize = padding == 0 ? tileSize : tileSize + padding;

        int cols = tileset.Width / cellSize;
        int rows = tileset.Height / cellSize;

        if (padding == 0)
        {
            // For no padding, dimensions should be exact multiples
            if (tileset.Width % tileSize != 0 || tileset.Height % tileSize != 0)
            {
                string name = sourcePath != null ? Path.GetFileName(sourcePath) : "tileset";
                return (false, 0, 0,
                    $"{name}: Dimensions {tileset.Width}x{tileset.Height} are not multiples of tile size {tileSize}");
            }
        }

        if (cols == 0 || rows == 0)
        {
            string name = sourcePath != null ? Path.GetFileName(sourcePath) : "tileset";
            return (false, 0, 0,
                $"{name}: Image too small for tile size {tileSize}");
        }

        return (true, cols, rows, null);
    }

    /// <summary>
    /// Gets info about a tileset without extracting tiles.
    /// </summary>
    public static (int Columns, int Rows, int TileCount) GetTilesetInfo(string tilesetPath, int tileSize, int padding = 0)
    {
        using var tileset = SKBitmap.Decode(tilesetPath);
        if (tileset == null)
        {
            return (0, 0, 0);
        }

        int cellSize = padding == 0 ? tileSize : tileSize + padding;
        int cols = tileset.Width / cellSize;
        int rows = tileset.Height / cellSize;

        if (padding == 0)
        {
            cols = tileset.Width / tileSize;
            rows = tileset.Height / tileSize;
        }

        return (cols, rows, cols * rows);
    }
}
