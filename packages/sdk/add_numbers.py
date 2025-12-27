def add(a, b):
    """
    Add two numbers together.

    Args:
        a: First number (int or float)
        b: Second number (int or float)

    Returns:
        The sum of a and b

    Raises:
        TypeError: If either argument is not a number

    Examples:
        >>> add(2, 3)
        5
        >>> add(1.5, 2.5)
        4.0
        >>> add(-1, 1)
        0
    """
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers (int or float)")

    return a + b


if __name__ == "__main__":
    # Example usage
    print(f"add(2, 3) = {add(2, 3)}")
    print(f"add(1.5, 2.5) = {add(1.5, 2.5)}")
    print(f"add(-1, 1) = {add(-1, 1)}")
