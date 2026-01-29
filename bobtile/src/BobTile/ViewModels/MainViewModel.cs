using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using BobTile.Core;
using BobTile.Core.ImageProcessing;
using BobTile.Core.Models;
using BobTile.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SkiaSharp;

namespace BobTile.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private const string DefaultDirectory = @"C:\Users\andre\lawchuck\artbob\CC0";
    private static readonly string[] SupportedExtensions = { ".png", ".webp" };
    private readonly IDialogService _dialogService;
    private readonly TilePacker _packer;

    public MainViewModel() : this(new DialogService()) { }

    public MainViewModel(IDialogService dialogService)
    {
        _dialogService = dialogService;
        _packer = new TilePacker();
        _selectedFiles = new ObservableCollection<string>();
        _selectedTilesets = new ObservableCollection<TilesetSelection>();

        if (UseDefaultDirectories)
        {
            OutputFolder = DefaultOutputDirectory;
        }
    }

    // Main mode: Tiles or Atlas
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private bool _isTilesMode = true;

    public bool IsAtlasMode
    {
        get => !IsTilesMode;
        set
        {
            if (IsTilesMode == value) // value=true means we want atlas, so tiles should be false
            {
                IsTilesMode = !value;
            }
        }
    }

    // Input mode for Tiles mode
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private bool _isFolderMode = true;

    public bool IsFileMode
    {
        get => !IsFolderMode;
        set => IsFolderMode = !value;
    }

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private string _folderPath = "";

    [ObservableProperty]
    private ObservableCollection<string> _selectedFiles;

    public string SelectedFilesDisplay => SelectedFiles.Count > 0
        ? $"{SelectedFiles.Count} file(s) selected"
        : "No files selected";

    // Atlas mode: selected tilesets
    [ObservableProperty]
    private ObservableCollection<TilesetSelection> _selectedTilesets;

    public string SelectedTilesetsDisplay => SelectedTilesets.Count > 0
        ? $"{SelectedTilesets.Count} tileset(s) selected"
        : "No tilesets selected";

    public void ApplyStartupArguments(IReadOnlyList<string>? args)
    {
        if (args == null || args.Count == 0)
        {
            return;
        }

        bool joinMode = false;
        var paths = new List<string>();

        foreach (var arg in args)
        {
            if (string.IsNullOrWhiteSpace(arg))
            {
                continue;
            }

            if (arg.Equals("--join", StringComparison.OrdinalIgnoreCase) ||
                arg.Equals("/join", StringComparison.OrdinalIgnoreCase))
            {
                joinMode = true;
                continue;
            }

            paths.Add(arg.Trim());
        }

        if (paths.Count == 0)
        {
            return;
        }

        if (!joinMode && paths.Count == 1)
        {
            var singlePath = paths[0];
            if (Directory.Exists(singlePath))
            {
                LoadFolderPath(singlePath);
                return;
            }

            if (File.Exists(singlePath))
            {
                var singleFile = ExpandToImageFiles(paths);
                if (singleFile.Count > 0)
                {
                    LoadTileFiles(singleFile);
                }
                return;
            }
        }

        var files = ExpandToImageFiles(paths);
        if (files.Count == 0)
        {
            return;
        }

        if (joinMode)
        {
            LoadTilesetsFromFiles(files);
        }
        else
        {
            LoadTileFiles(files);
        }
    }

    [ObservableProperty]
    private int _sourcePadding = 0;

    [ObservableProperty]
    private bool _startTilesetsOnNewRow = false;

    // Settings
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private int _tileSize = 32;

    public int[] TileSizePresets => new[] { 16, 24, 32, 48, 64 };

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private string _columnsText = "16";

    public int Columns => int.TryParse(ColumnsText, out int cols) ? cols :
                          ColumnsText.Equals("auto", StringComparison.OrdinalIgnoreCase) ? 0 : 16;

    [ObservableProperty]
    private int _padding = 0;

    [ObservableProperty]
    private bool _extrudeEdges = false;

    [ObservableProperty]
    private bool _resizeToTileSize = false;

    // Output
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private string _outputFolder = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(GenerateCommand))]
    private string _outputFilename = "tileset";

    [ObservableProperty]
    private bool _generateTsx = false;

    // Default directories
    [ObservableProperty]
    private bool _useDefaultDirectories = true;

    [ObservableProperty]
    private string _defaultInputDirectory = DefaultDirectory;

    [ObservableProperty]
    private string _defaultOutputDirectory = DefaultDirectory;

    // Status
    [ObservableProperty]
    private string _statusMessage = "Ready";

    [ObservableProperty]
    private int _progress = 0;

    [ObservableProperty]
    private bool _isProcessing = false;

    // Preview
    [ObservableProperty]
    private ImageSource? _previewImage;

    [ObservableProperty]
    private string _statsDisplay = "";

    // Commands
    [RelayCommand]
    private void BrowseFolder()
    {
        var folder = _dialogService.BrowseFolder(GetInputBrowsePath());
        if (folder != null)
        {
            FolderPath = folder;
            UpdatePreviewStats();
        }
    }

    [RelayCommand]
    private void SelectFiles()
    {
        var files = _dialogService.SelectImageFiles(
            GetInputBrowsePath());
        if (files != null && files.Length > 0)
        {
            AddUniqueFiles(SelectedFiles, files);
            OnPropertyChanged(nameof(SelectedFilesDisplay));
            GenerateCommand.NotifyCanExecuteChanged();
            UpdatePreviewStats();
        }
    }

    [RelayCommand]
    private void SelectTilesets()
    {
        var files = _dialogService.SelectImageFiles(
            GetInputBrowsePath());
        if (files != null && files.Length > 0)
        {
            AddUniqueTilesets(files);
            OnPropertyChanged(nameof(SelectedTilesetsDisplay));
            GenerateCommand.NotifyCanExecuteChanged();
            UpdatePreviewStats();
        }
    }

    [RelayCommand]
    private void EditTilesetSettings(TilesetSelection? tileset)
    {
        if (tileset == null)
        {
            return;
        }

        var newSize = _dialogService.PromptForInt(
            "Tileset Settings",
            $"Input tile size for:\n{tileset.FileName}",
            tileset.InputTileSize);

        if (newSize.HasValue && newSize.Value > 0)
        {
            tileset.InputTileSize = newSize.Value;
            UpdatePreviewStats();
        }
    }

    [RelayCommand]
    private void RemoveTileset(TilesetSelection? tileset)
    {
        if (tileset == null)
        {
            return;
        }

        SelectedTilesets.Remove(tileset);
        OnPropertyChanged(nameof(SelectedTilesetsDisplay));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    private static void AddUniqueFiles(ObservableCollection<string> target, IEnumerable<string> files)
    {
        var existing = new HashSet<string>(target, StringComparer.OrdinalIgnoreCase);
        foreach (var file in files)
        {
            if (existing.Add(file))
            {
                target.Add(file);
            }
        }
    }

    private void LoadTilesetsFromFiles(IReadOnlyList<string> files)
    {
        IsTilesMode = false;
        IsFolderMode = false;
        SelectedTilesets.Clear();
        SelectedFiles.Clear();
        FolderPath = "";
        AddUniqueTilesets(files);
        OnPropertyChanged(nameof(SelectedTilesetsDisplay));
        OnPropertyChanged(nameof(SelectedFilesDisplay));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    private void LoadTileFiles(IReadOnlyList<string> files)
    {
        IsTilesMode = true;
        IsFolderMode = false;
        SelectedFiles.Clear();
        SelectedTilesets.Clear();
        FolderPath = "";
        AddUniqueFiles(SelectedFiles, files);
        OnPropertyChanged(nameof(SelectedFilesDisplay));
        OnPropertyChanged(nameof(SelectedTilesetsDisplay));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    private void LoadFolderPath(string folderPath)
    {
        IsTilesMode = true;
        IsFolderMode = true;
        FolderPath = folderPath;
        SelectedFiles.Clear();
        SelectedTilesets.Clear();
        OnPropertyChanged(nameof(SelectedFilesDisplay));
        OnPropertyChanged(nameof(SelectedTilesetsDisplay));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    private void AddUniqueTilesets(IEnumerable<string> files)
    {
        var existing = new HashSet<string>(SelectedTilesets.Select(t => t.FilePath), StringComparer.OrdinalIgnoreCase);
        foreach (var file in files)
        {
            if (existing.Add(file))
            {
                SelectedTilesets.Add(new TilesetSelection(file, TileSize));
            }
        }
    }

    private static List<string> ExpandToImageFiles(IEnumerable<string> paths)
    {
        var files = new List<string>();

        foreach (var path in paths)
        {
            if (File.Exists(path))
            {
                if (IsSupportedImage(path))
                {
                    files.Add(path);
                }

                continue;
            }

            if (Directory.Exists(path))
            {
                files.AddRange(ImageLoader.GetImagesFromFolder(path));
            }
        }

        return ImageLoader.SortFiles(files);
    }

    private static bool IsSupportedImage(string path)
    {
        var extension = Path.GetExtension(path);
        return !string.IsNullOrWhiteSpace(extension) &&
               SupportedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase);
    }

    [RelayCommand]
    private void BrowseOutput()
    {
        var folder = _dialogService.BrowseFolder(GetOutputBrowsePath());
        if (folder != null)
        {
            OutputFolder = folder;
        }
    }

    [RelayCommand]
    private void RemoveSelectedFile(string? file)
    {
        if (string.IsNullOrEmpty(file))
        {
            return;
        }

        SelectedFiles.Remove(file);
        OnPropertyChanged(nameof(SelectedFilesDisplay));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    private bool CanGenerate()
    {
        if (IsProcessing) return false;
        if (TileSize <= 0) return false;
        if (string.IsNullOrWhiteSpace(OutputFolder)) return false;
        if (string.IsNullOrWhiteSpace(OutputFilename)) return false;

        // Validate columns
        if (!ColumnsText.Equals("auto", StringComparison.OrdinalIgnoreCase) &&
            (!int.TryParse(ColumnsText, out int cols) || cols <= 0))
        {
            return false;
        }

        if (IsAtlasMode)
        {
            return SelectedTilesets.Count > 0;
        }

        if (IsFolderMode)
        {
            return !string.IsNullOrWhiteSpace(FolderPath) && Directory.Exists(FolderPath);
        }
        else
        {
            return SelectedFiles.Count > 0;
        }
    }

    [RelayCommand(CanExecute = nameof(CanGenerate))]
    private async Task GenerateAsync()
    {
        IsProcessing = true;
        StatusMessage = IsAtlasMode ? "Combining tilesets..." : "Generating atlas...";
        Progress = 0;

        try
        {
            // Ensure output folder exists
            if (!Directory.Exists(OutputFolder))
            {
                if (_dialogService.Confirm("Create Folder?",
                    $"Output folder does not exist:\n{OutputFolder}\n\nCreate it?"))
                {
                    Directory.CreateDirectory(OutputFolder);
                }
                else
                {
                    StatusMessage = "Cancelled - output folder does not exist.";
                    return;
                }
            }

            InputMode mode;
            IReadOnlyList<string>? files;
            IReadOnlyList<TilesetInput>? tilesets = null;

            if (IsAtlasMode)
            {
                mode = InputMode.AtlasCombine;
                files = null;
                tilesets = SelectedTilesets
                    .Select(t => new TilesetInput(t.FilePath, t.InputTileSize))
                    .ToList();
            }
            else if (IsFolderMode)
            {
                mode = InputMode.Folder;
                files = null;
            }
            else
            {
                mode = InputMode.FileSelect;
                files = SelectedFiles.ToList();
            }

            var settings = new TilePackerSettings
            {
                Mode = mode,
                FolderPath = FolderPath,
                SelectedFiles = files ?? SelectedFiles.ToList(),
                SelectedTilesets = tilesets,
                TileSize = TileSize,
                Columns = Columns,
                Padding = Padding,
                ExtrudeEdges = ExtrudeEdges,
                ResizeToTileSize = ResizeToTileSize,
                SourcePadding = SourcePadding,
                StartTilesetsOnNewRow = StartTilesetsOnNewRow,
                OutputFolder = OutputFolder,
                OutputFilename = OutputFilename,
                GenerateTsx = GenerateTsx
            };

            var progressReporter = new Progress<int>(p =>
            {
                Progress = p;
                StatusMessage = IsAtlasMode
                    ? $"Combining tilesets... {p}%"
                    : $"Processing... {p}%";
            });

            var result = await Task.Run(() => _packer.Pack(settings, progressReporter, UpdatePreviewFromBitmap));

            if (result.Success)
            {
                StatusMessage = $"Saved: {result.OutputPath}";
                StatsDisplay = $"{result.TileCount} tiles | {result.Rows} rows x {result.Columns} cols | {result.AtlasWidth}x{result.AtlasHeight} px | {result.Duration.TotalMilliseconds:F0}ms";

                // Load preview
                await LoadPreviewAsync(result.OutputPath);

                string modeText = IsAtlasMode ? "Tilesets combined" : "Atlas generated";
                _dialogService.ShowInfo("Success",
                    $"{modeText} successfully!\n\n" +
                    $"Output: {result.OutputPath}\n" +
                    $"Tiles: {result.TileCount}\n" +
                    $"Size: {result.AtlasWidth} x {result.AtlasHeight} px\n" +
                    $"Time: {result.Duration.TotalMilliseconds:F0}ms" +
                    (result.TsxPath != null ? $"\nTSX: {result.TsxPath}" : ""));
            }
            else
            {
                var errors = result.Errors != null ? string.Join("\n", result.Errors) : "Unknown error";
                StatusMessage = "Failed - see error details.";
                _dialogService.ShowError("Generation Failed", errors);
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error: {ex.Message}";
            _dialogService.ShowError("Error", ex.Message);
        }
        finally
        {
            IsProcessing = false;
            Progress = 0;
        }
    }

    private async Task LoadPreviewAsync(string imagePath)
    {
        await Task.Run(() =>
        {
            using var stream = File.OpenRead(imagePath);
            using var skBitmap = SKBitmap.Decode(stream);
            if (skBitmap != null)
            {
                Application.Current.Dispatcher.Invoke(() =>
                {
                    PreviewImage = ConvertToImageSource(skBitmap);
                });
            }
        });
    }

    private void UpdatePreviewFromBitmap(SKBitmap bitmap)
    {
        Application.Current.Dispatcher.Invoke(() =>
        {
            PreviewImage = ConvertToImageSource(bitmap);
        });
    }

    private static BitmapSource ConvertToImageSource(SKBitmap skBitmap)
    {
        var info = skBitmap.Info;
        var bitmap = new WriteableBitmap(info.Width, info.Height, 96, 96, PixelFormats.Bgra32, null);

        bitmap.Lock();
        try
        {
            using var surface = SKSurface.Create(
                new SKImageInfo(info.Width, info.Height, SKColorType.Bgra8888, SKAlphaType.Premul),
                bitmap.BackBuffer,
                bitmap.BackBufferStride);
            surface.Canvas.DrawBitmap(skBitmap, 0, 0);
            bitmap.AddDirtyRect(new System.Windows.Int32Rect(0, 0, info.Width, info.Height));
        }
        finally
        {
            bitmap.Unlock();
        }

        bitmap.Freeze();
        return bitmap;
    }

    private void UpdatePreviewStats()
    {
        try
        {
            if (IsAtlasMode)
            {
                UpdateAtlasModeStats();
                return;
            }

            List<string> files;
            if (IsFolderMode && !string.IsNullOrWhiteSpace(FolderPath) && Directory.Exists(FolderPath))
            {
                files = ImageLoader.GetImagesFromFolder(FolderPath);
            }
            else if (!IsFolderMode && SelectedFiles.Count > 0)
            {
                files = SelectedFiles.ToList();
            }
            else
            {
                StatsDisplay = "";
                return;
            }

            if (files.Count == 0)
            {
                StatsDisplay = "No images found";
                return;
            }

            var dims = AtlasGenerator.CalculateDimensions(
                files.Count,
                TileSize,
                Columns,
                Padding,
                ExtrudeEdges);

            StatsDisplay = $"{files.Count} tiles | {dims.Rows} rows x {dims.Columns} cols | {dims.Width}x{dims.Height} px";
        }
        catch
        {
            StatsDisplay = "";
        }
    }

    private void UpdateAtlasModeStats()
    {
        if (SelectedTilesets.Count == 0)
        {
            StatsDisplay = "";
            return;
        }

        try
        {
            var tileCounts = new List<int>();
            int totalTiles = 0;
            foreach (var tileset in SelectedTilesets)
            {
                var info = TilesetExtractor.GetTilesetInfo(tileset.FilePath, tileset.InputTileSize, SourcePadding);
                tileCounts.Add(info.TileCount);
                totalTiles += info.TileCount;
            }

            if (totalTiles == 0)
            {
                StatsDisplay = "No tiles found (check tile size)";
                return;
            }

            (int Rows, int Columns, int Width, int Height) dims;
            if (StartTilesetsOnNewRow)
            {
                dims = AtlasGenerator.CalculateDimensionsWithGroups(
                    tileCounts,
                    TileSize,
                    Columns,
                    Padding,
                    ExtrudeEdges);
            }
            else
            {
                dims = AtlasGenerator.CalculateDimensions(
                    totalTiles,
                    TileSize,
                    Columns,
                    Padding,
                    ExtrudeEdges);
            }

            StatsDisplay = $"{SelectedTilesets.Count} tilesets | ~{totalTiles} tiles | {dims.Rows} rows x {dims.Columns} cols | {dims.Width}x{dims.Height} px";
        }
        catch
        {
            StatsDisplay = $"{SelectedTilesets.Count} tileset(s) selected";
        }
    }

    partial void OnIsTilesModeChanged(bool value)
    {
        OnPropertyChanged(nameof(IsAtlasMode));
        GenerateCommand.NotifyCanExecuteChanged();
        UpdatePreviewStats();
    }

    partial void OnIsFolderModeChanged(bool value)
    {
        OnPropertyChanged(nameof(IsFileMode));
        UpdatePreviewStats();
    }

    partial void OnUseDefaultDirectoriesChanged(bool value)
    {
        if (value)
        {
            OutputFolder = DefaultOutputDirectory;
        }
    }

    partial void OnDefaultOutputDirectoryChanged(string value)
    {
        if (UseDefaultDirectories)
        {
            OutputFolder = value;
        }
    }

    partial void OnFolderPathChanged(string value) => UpdatePreviewStats();
    partial void OnTileSizeChanged(int value) => UpdatePreviewStats();
    partial void OnColumnsTextChanged(string value) => UpdatePreviewStats();
    partial void OnPaddingChanged(int value) => UpdatePreviewStats();
    partial void OnExtrudeEdgesChanged(bool value) => UpdatePreviewStats();
    partial void OnSourcePaddingChanged(int value) => UpdatePreviewStats();
    partial void OnStartTilesetsOnNewRowChanged(bool value) => UpdatePreviewStats();

    private string? GetInputBrowsePath()
    {
        if (UseDefaultDirectories)
        {
            return DefaultInputDirectory;
        }

        if (IsFolderMode && !string.IsNullOrWhiteSpace(FolderPath))
        {
            return FolderPath;
        }

        if (!IsFolderMode && SelectedFiles.Count > 0)
        {
            return Path.GetDirectoryName(SelectedFiles[0]);
        }

        if (SelectedTilesets.Count > 0)
        {
            return Path.GetDirectoryName(SelectedTilesets[0].FilePath);
        }

        return null;
    }

    private string? GetOutputBrowsePath()
    {
        if (UseDefaultDirectories)
        {
            return DefaultOutputDirectory;
        }

        if (!string.IsNullOrWhiteSpace(OutputFolder))
        {
            return OutputFolder;
        }

        return null;
    }
}
