def add(a: float, b: float) -> float:
    """
    Add two numbers together.

    Args:
        a: The first number
        b: The second number

    Returns:
        The sum of a and b

    Raises:
        TypeError: If either argument is not a number

    Examples:
        >>> add(2, 3)
        5
        >>> add(-1, 1)
        0
        >>> add(2.5, 3.7)
        6.2
    """
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        raise TypeError("Both arguments must be numbers")

    return a + b


if __name__ == "__main__":
    # Example usage
    print(f"add(2, 3) = {add(2, 3)}")
    print(f"add(-1, 1) = {add(-1, 1)}")
    print(f"add(2.5, 3.7) = {add(2.5, 3.7)}")
