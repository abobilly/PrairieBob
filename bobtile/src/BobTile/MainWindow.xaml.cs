using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using BobTile.ViewModels;

namespace BobTile;

public partial class MainWindow : Window
{
    private Point _dragStartPoint;
    private bool _startupArgsApplied;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (_startupArgsApplied)
        {
            return;
        }

        _startupArgsApplied = true;

        if (DataContext is MainViewModel viewModel)
        {
            viewModel.ApplyStartupArguments(App.StartupArguments);
        }
    }

    private void OnListBoxPreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        _dragStartPoint = e.GetPosition(null);
    }

    private void OnListBoxPreviewMouseMove(object sender, MouseEventArgs e)
    {
        if (e.LeftButton != MouseButtonState.Pressed)
        {
            return;
        }

        var position = e.GetPosition(null);
        if (Math.Abs(position.X - _dragStartPoint.X) < SystemParameters.MinimumHorizontalDragDistance &&
            Math.Abs(position.Y - _dragStartPoint.Y) < SystemParameters.MinimumVerticalDragDistance)
        {
            return;
        }

        if (sender is not ListBox listBox)
        {
            return;
        }

        var listBoxItem = FindAncestor<ListBoxItem>(e.OriginalSource as DependencyObject);
        if (listBoxItem?.DataContext == null)
        {
            return;
        }

        DragDrop.DoDragDrop(listBoxItem, listBoxItem.DataContext, DragDropEffects.Move);
    }

    private void OnSelectedFilesDrop(object sender, DragEventArgs e)
    {
        if (DataContext is not MainViewModel viewModel || sender is not ListBox listBox)
        {
            return;
        }

        HandleDrop(listBox, e, viewModel.SelectedFiles);
    }

    private void OnSelectedTilesetsDrop(object sender, DragEventArgs e)
    {
        if (DataContext is not MainViewModel viewModel || sender is not ListBox listBox)
        {
            return;
        }

        HandleDrop(listBox, e, viewModel.SelectedTilesets);
    }

    private static void HandleDrop<T>(ListBox listBox, DragEventArgs e, ObservableCollection<T> items) where T : class
    {
        if (!e.Data.GetDataPresent(typeof(T)))
        {
            return;
        }

        var droppedData = (T)e.Data.GetData(typeof(T));
        if (droppedData == null)
        {
            return;
        }

        var targetData = GetDataFromPoint<T>(listBox, e.GetPosition(listBox));
        int oldIndex = items.IndexOf(droppedData);
        if (oldIndex < 0)
        {
            return;
        }

        int newIndex = targetData != null ? items.IndexOf(targetData) : items.Count - 1;
        if (newIndex < 0)
        {
            newIndex = items.Count - 1;
        }

        if (oldIndex == newIndex)
        {
            return;
        }

        items.Move(oldIndex, newIndex);
    }

    private static T? GetDataFromPoint<T>(ListBox listBox, Point point) where T : class
    {
        var element = listBox.InputHitTest(point) as DependencyObject;
        var listBoxItem = FindAncestor<ListBoxItem>(element);
        return listBoxItem?.DataContext as T;
    }

    private static T? FindAncestor<T>(DependencyObject? current) where T : DependencyObject
    {
        while (current != null && current is not T)
        {
            current = VisualTreeHelper.GetParent(current);
        }

        return current as T;
    }
}