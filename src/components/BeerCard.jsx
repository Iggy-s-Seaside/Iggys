function BeerCard({ item: { name, type, price, description } }) {
    return (
        <div>
            <h1>
                {name.toUpperCase()} {price}
            </h1>
            <p>{type}</p>
            <p>{description}</p>
        </div>
    );
}

export default BeerCard;
